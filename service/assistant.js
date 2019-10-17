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

const assert = require('assert');
const events = require('events');
const child_process = require('child_process');

const Almond = require('almond-dialog-agent');
let SpeechHandler;
try {
    SpeechHandler = require('./speech_handler');
} catch(e) {
    SpeechHandler = null;
}
const AlmondApi = require('./almond_api');

const Config = require('../config');

class LocalUser {
    constructor() {

        this.id = process.getuid();
        this.account = '';//pwnam.name;
        this.name = '';//pwnam.gecos;
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
        this._history = [];
    }

    clearSpeechQueue() {
        if (this._speechSynth)
            this._speechSynth.clearQueue();
    }
    setConversation(conversation) {
        this._conversation = conversation;
    }

    sendHypothesis(hypothesis) {
        for (let out of this._outputs)
            out.sendHypothesis(hypothesis);
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
    constructor(engine, speechHandler, options) {
        super(engine, 'main', new LocalUser(), new MainConversationDelegate(engine.platform, speechHandler), options);
        this._delegate.setConversation(this);
    }

    sendHypothesis(hypothesis) {
        this._delegate.sendHypothesis(hypothesis);
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
        this._delegate.addCommandToHistory("\\t " + code);
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
        this._delegate.sendCommand("\\t " + code);
        return super.handleThingTalk(code);
    }
}

class StatelessConversationDelegate {
    constructor(locale) {
        this._locale = locale;
        this._buffer = [];
        this._askSpecial = null;
    }

    flush() {
        const buffer = this._buffer;
        const askSpecial = this._askSpecial;
        this._buffer = [];
        this._askSpecial = null;
        return {
            messages: buffer,
            askSpecial: askSpecial
        };
    }

    send(text, icon) {
        this._buffer.push({ type: 'text', text, icon });
    }

    sendPicture(url, icon) {
        this._buffer.push({ type: 'picture', url, icon });
    }

    sendChoice(idx, what, title, text) {
        this._buffer.push({ type: 'choice', idx, title, text });
    }

    sendLink(title, url) {
        this._buffer.push({ type: 'link', title, url });
    }

    sendButton(title, json) {
        this._buffer.push({ type: 'button', title, json });
    }

    sendRDL(rdl, icon) {
        this._buffer.push({ type: 'rdl', rdl, icon });
    }

    sendResult(message, icon) {
        this._buffer.push({
            type: 'result',
            result: message,

            fallback: message.toLocaleString(this._locale),
            icon
        });
    }

    sendAskSpecial(what) {
        assert(this._askSpecial === null);
        this._askSpecial = what;
    }
}

module.exports = class Assistant extends events.EventEmitter {
    constructor(engine) {
        super();

        this._engine = engine;
        this._platform = engine.platform;
        this._api = new AlmondApi(this._engine);

        if (SpeechHandler && this._platform.hasCapability('pulseaudio'))
            this._speechHandler = new SpeechHandler(engine.platform);
        else
            this._speechHandler = null;
        this._speechSynth = this._platform.getCapability('text-to-speech');
        this._mainConversation = new MainConversation(engine, this._speechHandler, {
            sempreUrl: Config.SEMPRE_URL,
            showWelcome: true
        });
        this._statelessConversation = new Almond(engine, 'stateless', new LocalUser(), new StatelessConversationDelegate(this._platform.locale), {
            sempreUrl: Config.SEMPRE_URL,
            showWelcome: false
        });

        if (this._speechHandler) {
            this._speechHandler.on('hypothesis', (hypothesis) => {
                //this._api.sendHypothesis(hypothesis);
                this._mainConversation.sendHypothesis(hypothesis);
            });
            this._speechHandler.on('hotword', (hotword) => {
                child_process.spawn('xset', ['dpms', 'force', 'on']);
                child_process.spawn('canberra-gtk-play', ['-f', '/usr/share/sounds/purple/receive.wav']);
            });
            this._speechHandler.on('utterance', (utterance) => {
                //this._api.sendCommand(utterance);
                this._mainConversation.handleCommand(utterance);
            });
            this._speechHandler.on('error', (error) => {
                console.log('Error in speech recognition: ' + error.message);
                this._speechSynth.say("Sorry, I had an error understanding your speech: " + error.message);
            });
        }

        this._conversations = {
            api: this._api,
            main: this._mainConversation,
            stateless: this._statelessConversation
        };
        this._lastConversation = this._mainConversation;
    }

    async converse(command) {
        const conversation = this._conversations.stateless;
        const delegate = conversation._delegate;

        if (command.type === 'command')
            await conversation.handleCommand(command.text);
        else if (command.type === 'parsed')
            await conversation.handleParsedCommand(command.json);
        else if (command.type === 'tt')
            await conversation.handleThingTalk(command.code);
        else
            throw new Error('Invalid command type ' + command.type);

        return delegate.flush();
    }

    hotword() {
        if (!this._speechHandler)
            return;
        this._speechHandler.hotword();
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

    async start() {
        if (this._speechSynth)
            await this._speechSynth.start();
        if (this._speechHandler)
            await this._speechHandler.start();
    }

    async startConversation() {
        await this._mainConversation.start();

        await this._statelessConversation.start();
    }

    stop() {
        if (this._speechSynth)
            this._speechSynth.stop();
        if (this._speechHandler)
            this._speechHandler.stop();
    }

    notifyAll(...data) {
        return Promise.all(Object.keys(this._conversations).map((id) => {
            if (id === 'stateless')
                return Promise.resolve();
            return this._conversations[id].notify(...data);
        }));
    }

    notifyErrorAll(...data) {
        return Promise.all(Object.keys(this._conversations).map((id) => {
            if (id === 'stateless')
                return Promise.resolve();
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
        var conv = new OtherConversation(this._engine, feedId, new LocalUser(), delegate, {
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
