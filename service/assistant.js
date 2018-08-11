// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//           2018 Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const path = require('path');
const events = require('events');
const child_process = require('child_process');

const db = require('../util/db');
const users = require('../model/user');

const SpeechHandler = require('./speech_handler');
const SpeechSynthesizer = require('./speech_synthesizer');

const MessageType = {
    TEXT: 0,
    PICTURE: 1,
    CHOICE: 2,
    LINK: 3,
    BUTTON: 4,
    ASK_SPECIAL: 5,
    RDL: 6,
    MAX: 6
};

class MainConversationDelegate {
    constructor(speechSynth, speechHandler) {
        this._speechSynth = speechSynth;
        this._outputs = new Set;

        this._speechHandler = speechHandler;
        this._history = [];
    }

    sendHypothesis(hypothesis) {
        for (let out of this._outputs)
            out.sendHypothesis(hypothesis);
    }

    clearSpeechQueue() {
        if (this._speechSynth)
            this._speechSynth.clearQueue();
    }

    addOutput(out) {
        this._outputs.add(out);
        for (let [,msg] of this._history) // replay the history
            msg(out);
    }
    removeOutput(out) {
        this._outputs.delete(out);
    }

    _emit(msg) {
        for (let out of this._outputs)
            msg(out);
    }

    collapseButtons() {
        for (let i = this._history.length-1; i >= 0; i--) {
            let [type,] = this._history[i];
            if (type === MessageType.ASK_SPECIAL || type === MessageType.CHOICE || type === MessageType.BUTTON)
                this._history.pop();
            else
                break;
        }
    }

    _addMessage(type, msg) {
        this._history.push([type, msg]);
        if (this._history.length > 30)
            this._history.shift();
        this._emit(msg);
    }

    addCommandToHistory(msg) {
        this._addMessage(MessageType.TEXT, (out) => out.sendCommand(msg));
    }

    send(text, icon) {
        if (this._speechSynth)
            this._speechSynth.say(text);
        this._addMessage(MessageType.TEXT, (out) => out.send(text, icon));
    }

    sendPicture(url, icon) {
        this._addMessage(MessageType.PICTURE, (out) => out.sendPicture(url, icon));
    }

    sendChoice(idx, what, title, text) {
        if (this._speechSynth)
            this._speechSynth.say(title);
        this._addMessage(MessageType.CHOICE, (out) => out.sendChoice(idx, what, title, text));
    }

    sendLink(title, url) {
        this._addMessage(MessageType.LINK, (out) => out.sendLink(title, url));
    }

    sendButton(title, json) {
        if (this._speechSynth)
            this._speechSynth.say(title);
        this._addMessage(MessageType.BUTTON, (out) => out.sendButton(title, json));
    }

    sendAskSpecial(what) {
        this._addMessage(MessageType.ASK_SPECIAL, (out) => out.sendAskSpecial(what));
    }

    sendRDL(rdl, icon) {
        if (this._speechSynth)
            this._speechSynth.say(rdl.displayTitle);
        this._addMessage(MessageType.RDL, (out) => out.sendRDL(rdl, icon));
    }
}
MainConversationDelegate.prototype.$rpcMethods = [
    'send', 'sendPicture', 'sendChoice', 'sendLink', 'sendButton',
    'sendAskSpecial', 'sendRDL',
    'addCommandToHistory', 'sendCommand',
    'clearSpeechQueue', 'collapseButtons'
];

module.exports = class Assistant extends events.EventEmitter {
    constructor(enginemanager) {
        super();

        this._enginemanager = enginemanager;
        this._children = new Map;

        this._pulse = platform.getCapability('pulseaudio');
        if (this._pulse !== null) {
            this._speechSynth = new SpeechSynthesizer(this._pulse,
                path.resolve(module.filename, '../../data/cmu_us_slt.flitevox'));
            this._speechHandler = new SpeechHandler(this._pulse, this._locale);

            this._speechHandler.on('hypothesis', (hypothesis) => {
                this._mainConvDelegate.sendHypothesis(hypothesis);
            });
            this._speechHandler.on('hotword', (hotword) => {
                child_process.spawn('xset', ['dpms', 'force', 'on']);
                child_process.spawn('canberra-gtk-play', ['-f', '/usr/share/sounds/purple/receive.wav']);
            });
            this._speechHandler.on('utterance', (utterance, speaker) => {
                this._dispatchUtteranceForSpeaker(utterance, speaker);
            });
            this._speechHandler.on('error', (error) => {
                console.log('Error in speech recognition: ' + error.message);
                this._mainConvDelegate.send("Sorry, I had an error understanding your speech: " + error.message, null);
            });
        } else {
            this._speechSynth = null;
            this._speechHandler = null;
        }

        this._mainConvDelegate = new MainConversationDelegate(this._speechSynth, this._speechHandler);
    }

    parse(sentence, target) {
        return this._api.parse(sentence, target);
    }
    createApp(data) {
        return this._api.createApp(data);
    }
    addOutput(out) {
        this._api.addOutput(out);
    }
    removeOutput(out) {
        this._api.removeOutput(out);
    }

    start() {
        return Promise.all([
            this._speechSynth ? this._speechSynth.start() : null,
            this._speechHandler ? this._speechHandler.start() : null,
        ]);
    }

    stop() {
        if (this._speechSynth)
            this._speechSynth.stop();
        if (this._speechHandler)
            this._speechHandler.stop();
    }

    async _dispatchUtteranceForSpeaker(utterance, speaker) {
        if (speaker.id === null || speaker.confidence < 0) {
            this._mainConvDelegate.send("Sorry, I am not sure who is speaking.", null);
            return;
        }

        const user = await db.withClient((client) => {
            return users.getBySpeakerGUID(client, speaker.id);
        });
        console.log('Identified as ' + user.username);
        const [assistant,] = await this._ensureAssistantForUser(user.id);
        const mainConv = await assistant.getConversation('main');
        await mainConv.handleCommand(utterance);
    }

    async getConversation(userId, id) {
        const [assistant,] = await this._ensureAssistantForUser(userId);
        return assistant.getConversation(id);
    }

    async _initNewUser(userId) {
        const engine = await this._enginemanager.getEngine(userId);
        const conv = await engine.assistant.openConversation('main', engine.user,
                                                             this._mainConvDelegate,
                                                             { showWelcome: false });
        await conv.start();
        return [engine.assistant, engine.user];
    }

    _ensureAssistantForUser(userId) {
        if (this._children.has(userId))
            return this._children.get(userId);

        const promise = this._initNewUser(userId);
        this._children.set(userId, promise);
        return promise;
    }

    async openConversation(userId, convId, delegate) {
        const [assistant, user] = await this._ensureAssistantForUser(userId);
        return assistant.openConversation(convId, user, delegate);
    }

    closeConversation(userId, feedId) {
        if (!this._children.has(userId))
            return Promise.resolve();
        const [assistant,] = this._children.get(userId);
        return assistant.closeConversation(feedId);
    }
};
