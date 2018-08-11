// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const events = require('events');
const child_process = require('child_process');

const Almond = require('almond-dialog-agent');

const SpeechHandler = require('./speech_handler');
const AlmondApi = require('./almond_api');

const Config = require('../config');

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
    constructor(platform, speechHandler) {
        this._speechSynth = platform.getCapability('text-to-speech');
        this._outputs = new Set;

        this._speechHandler = speechHandler;
        if (speechHandler) {
            this._speechHandler.on('hypothesis', (hypothesis) => {
                this.sendHypothesis(hypothesis);
            });
            this._speechHandler.on('hotword', (hotword) => {
                this.playHotwordAlert();
            });
            this._speechHandler.on('error', (error) => {
                console.log('Error in speech recognition: ' + error.message);
                this.playRecognitionError();
            });
        }

        this._history = [];
    }

    playHotwordAlert() {
        child_process.spawn('xset', ['dpms', 'force', 'on']);
        child_process.spawn('canberra-gtk-play', ['-f', '/usr/share/sounds/purple/receive.wav']);
    }

    playRecognitionError() {
        child_process.spawn('canberra-gtk-play', ['-i', 'message-error']);
    }

    sendHypothesis(hypothesis) {
        for (let out of this._outputs)
            out.sendHypothesis(hypothesis);
    }

    clearSpeechQueue() {
        if (this._speechSynth)
            this._speechSynth.clearQueue();
    }
    setConversation(conversation) {
        this._conversation = conversation;
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

class MainConversation extends Almond {
    handleCommand(command) {
        this._delegate.clearSpeechQueue();
        this._delegate.collapseButtons();
        this._delegate.addCommandToHistory(command);
        return super.handleCommand.apply(this, arguments);
    }

    handleParsedCommand(json, title) {
        this._delegate.clearSpeechQueue();
        this._delegate.collapseButtons();
        this._delegate.addCommandToHistory(title);
        return super.handleParsedCommand.apply(this, arguments);
    }

    handleThingTalk(code) {
        this._delegate.clearSpeechQueue();
        this._delegate.collapseButtons();
        this._delegate.addCommandToHistory("Code: " + code);
        return super.handleThingTalk.apply(this, arguments);
    }

    presentExample() {
        this._delegate.clearSpeechQueue();
        this._delegate.collapseButtons();
        return super.presentExample.apply(this, arguments);
    }
}

class OtherConversation extends Almond {

    handleCommand(command) {
        this._delegate.sendCommand(command);
        return super.handleCommand(command);
    }

    handleParsedCommand(json, title) {
        this._delegate.sendCommand(title);
        return super.handleParsedCommand(json);
    }

    handleThingTalk(code) {
        this._delegate.sendCommand("Code: " + code);
        return super.handleThingTalk(code);
    }
}

module.exports = class Assistant extends events.EventEmitter {
    constructor(engine) {
        super();

        this._engine = engine;
        this._api = new AlmondApi(this._engine);

        this._contacts = engine.platform.getCapability('contacts');
        this._pulse = engine.platform.getCapability('pulseaudio');

        if (this._pulse !== null) {
            this._speechSynth = engine.platform.getCapability('text-to-speech');

            this._speechHandler = new SpeechHandler(engine.platform);
            this._speechHandler.on('utterance', (utterance, speaker) => {
                this._dispatchUtteranceForSpeaker(utterance, speaker);
            });
        } else {
            this._speechSynth = null;
            this._speechHandler = null;
        }

        this._mainConvDelegate = new MainConversationDelegate(engine.platform, this._speechHandler);
        this._mainConversation = new MainConversation(engine, 'main',
            this._contactToUser(this._contacts.getOwnerContact()), this._mainConvDelegate, {
            sempreUrl: Config.SEMPRE_URL,
            showWelcome: true
        });

        this._speechConversations = new Map;

        const owner = this._contacts.getOwnerContact();
        if (owner.speakerId)
            this._speechConversations.set(owner.speakerId, this._mainConversation);

        this._conversations = new Map;
        this._conversations.set('api', this._api);
        this._conversations.set('main', this._mainConversation);

        this._lastConversation = this._mainConversation;
    }

    _contactToUser(contact) {
        return {
            name: contact.displayName,
            anonymous: false,
            isOwner: true,
            speakerId: contact.speakerId,
        };
    }

    async _dispatchUtteranceForSpeaker(utterance, speaker) {
        if (speaker.confidence < 0) {
            if (this._speechSynth)
                this._speechSynth.say("Sorry, I'm not sure who is speaking.");
            else
                this._mainConvDelegate.playRecognitionError();
            return;
        }

        if (!this._speechConversations.has(speaker.id)) {
            let user, convId;
            if (speaker.id !== null) {
                convId = 'main-' + speaker.id;
                user = this._contactToUser(this._contacts.lookupPrincipal('speaker:' + speaker.id));
                user.isOwner = false;
                // the owner already has a conversation created so it never goes down
                // this path
                console.log('Identified as ' + user.name);
            } else {
                convId = 'main-anonymous';
                user = {
                    name: "Anonymous",
                    anonymous: true,
                    isOwner: false,
                    speakerId: null,
                };
                console.log('Identified as anonymous user');
            }

            const conv = this.openConversation(convId, this._mainConvDelegate, user, { showWelcome: false });
            this._speechConversations.set(speaker.id, conv);
            await conv.start();
        }

        const conv = this._speechConversations.get(speaker.id);
        await conv.handleCommand(utterance);
    }

    parse(sentence, target) {
        return this._api.parse(sentence, target);
    }
    createApp(data) {
        return this._api.createApp(data);
    }

    addMainOutput(out) {
        this._mainConvDelegate.addOutput(out);
    }
    addOutput(out) {
        this._api.addOutput(out);
    }
    removeMainOutput(out) {
        this._mainConvDelegate.removeOutput(out);
    }
    removeOutput(out) {
        this._api.removeOutput(out);
    }

    start() {
        return Promise.all([
            this._speechSynth.start(),
            this._speechHandler.start(),
            this._mainConversation.start()
        ]);
    }

    stop() {
        this._speechSynth.stop();
        this._speechHandler.stop();
    }

    notifyAll(...data) {
        return Promise.all(Array.from(this._conversations.values()).map((conv) => {
            return conv.notify(...data);
        }));
    }

    notifyErrorAll(...data) {
        return Promise.all(Array.from(this._conversations.values()).map((conv) => {
            return conv.notifyError(...data);
        }));
    }

    getMainConversation() {
        return this._mainConversation;
    }

    getConversation(id) {
        if (id !== undefined && this._conversations.has(id))
            return this._conversations.get(id);
        else if (this._lastConversation)
            return this._lastConversation;
        else
            return this._mainConversation;
    }

    openConversation(feedId, delegate, user, options = { showWelcome: true }) {
        if (this._conversations.has(feedId))
            this._conversations.delete(feedId);

        if (!user)
            user = this._contactToUser(this._contacts.getOwnerContact());
        const convClass = delegate === this._mainConvDelegate ?
            MainConversation : OtherConversation;

        options.sempreUrl = Config.SEMPRE_URL;
        var conv = new convClass(this._engine, feedId, user, delegate, options);
        conv.on('active', () => this._lastConversation = conv);
        if (user.primary)
            this._lastConversation = conv;
        this._conversations.set(feedId, conv);
        return conv;
    }

    closeConversation(feedId) {
        if (this._conversations.get(feedId) === this._lastConversation)
            this._lastConversation = null;
        delete this._conversations.get(feedId);
    }
};
