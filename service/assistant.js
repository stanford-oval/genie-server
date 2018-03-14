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
const posix = require('posix');
const child_process = require('child_process');

const Almond = require('almond');
const SpeechHandler = require('./speech_handler');

const Config = require('../config');

class LocalUser {
    constructor() {
        var pwnam = posix.getpwnam(process.getuid());

        this.id = process.getuid();
        this.account = pwnam.name;
        this.name = pwnam.gecos;
    }
}

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
        this._speechHandler.on('hypothesis', (hypothesis) => {
            for (let out of this._outputs)
                out.sendHypothesis(hypothesis);
        });
        this._speechHandler.on('hotword', (hotword) => {
            child_process.spawn('xset', ['dpms', 'force', 'on']);
            child_process.spawn('canberra-gtk-play', ['-f', '/usr/share/sounds/purple/receive.wav']);
        });
        this._speechHandler.on('utterance', (utterance) => {
            for (let out of this._outputs)
                out.sendCommand(utterance);
            this._conversation.handleCommand(utterance).catch((e) => {
                console.error(e.stack);
            });
        });
        this._speechHandler.on('error', (error) => {
            console.log('Error in speech recognition: ' + error.message);
            this._speechSynth.say("Sorry, I had an error understanding your speech: " + error.message);
        });

        this._history = [];
    }

    clearSpeechQueue() {
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
        this._speechSynth.say(text);
        this._addMessage(MessageType.TEXT, (out) => out.send(text, icon));
    }

    sendPicture(url, icon) {
        this._addMessage(MessageType.PICTURE, (out) => out.sendPicture(url, icon));
    }

    sendChoice(idx, what, title, text) {
        this._speechSynth.say(title);
        this._addMessage(MessageType.CHOICE, (out) => out.sendChoice(idx, what, title, text));
    }

    sendLink(title, url) {
        this._addMessage(MessageType.LINK, (out) => out.sendLink(title, url));
    }

    sendButton(title, json) {
        this._speechSynth.say(title);
        this._addMessage(MessageType.BUTTON, (out) => out.sendButton(title, json));
    }

    sendAskSpecial(what) {
        this._addMessage(MessageType.ASK_SPECIAL, (out) => out.sendAskSpecial(what));
    }

    sendRDL(rdl, icon) {
        this._speechSynth.say(rdl.displayTitle);
        this._addMessage(MessageType.RDL, (out) => out.sendRDL(rdl, icon));
    }
}

class MainConversation extends Almond {
    constructor(engine, speechHandler, options) {
        super(engine, 'main', new LocalUser(), new MainConversationDelegate(engine.platform, speechHandler), options);
        this._delegate.setConversation(this);
    }

    addOutput(out) {
        this._delegate.addOutput(out);
    }
    removeOutput(out) {
        this._delegate.removeOutput(out);
    }

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

module.exports = class Assistant extends events.EventEmitter {
    constructor(engine) {
        super();

        this._engine = engine;
        this._conversations = {};
        this._lastConversation = null;

        this._speechHandler = new SpeechHandler(engine.platform);
        this._speechSynth = platform.getCapability('text-to-speech');
        this._mainConversation = new MainConversation(engine, this._speechHandler, {
            sempreUrl: Config.SEMPRE_URL,
            showWelcome: true
        });
        this._conversations['main'] = this._lastConversation = this._mainConversation;
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
        return Q.all(Object.keys(this._conversations).map((id) => {
            return this._conversations[id].notify(...data);
        }));
    }

    notifyErrorAll(...data) {
        return Q.all(Object.keys(this._conversations).map((id) => {
            return this._conversations[id].notifyError(...data);
        }));
    }

    getMainConversation() {
        return this._mainConversation;
    }

    getConversation(id) {
        if (id !== undefined && this._conversations[id])
            return this._conversations[id];
        else if (this._lastConversation)
            return this._lastConversation;
        else
            return this._mainConversation;
    }

    openConversation(feedId, delegate) {
        if (this._conversations[feedId])
            delete this._conversations[feedId];
        var conv = new Almond(this._engine, feedId, new LocalUser(), delegate, {
            sempreUrl: Config.SEMPRE_URL,
            showWelcome: true
        });
        conv.on('active', () => this._lastConversation = conv);
        this._lastConversation = conv;
        this._conversations[feedId] = conv;
        return conv;
    }

    closeConversation(feedId) {
        if (this._conversations[feedId] === this._lastConversation)
            this._lastConversation = null;
        delete this._conversations[feedId];
    }
};
