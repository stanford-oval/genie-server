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

const Almond = require('almond-dialog-agent');
const AlmondApi = require('./almond_api');

const Config = require('../config');

class MainConversation extends Almond {
    addOutput(out) {
        this._delegate.addOutput(out);
    }
    removeOutput(out) {
        this._delegate.removeOutput(out);
    }

    async handleCommand(command) {
        await this._delegate.clearSpeechQueue();
        await this._delegate.collapseButtons();
        await this._delegate.addCommandToHistory(command);
        return super.handleCommand.apply(this, arguments);
    }

    async handleParsedCommand(json, title) {
        await this._delegate.clearSpeechQueue();
        await this._delegate.collapseButtons();
        await this._delegate.addCommandToHistory(title);
        return super.handleParsedCommand.apply(this, arguments);
    }

    async handleThingTalk(code) {
        await this._delegate.clearSpeechQueue();
        await this._delegate.collapseButtons();
        await this._delegate.addCommandToHistory("Code: " + code);
        return super.handleThingTalk.apply(this, arguments);
    }

    async presentExample() {
        await this._delegate.clearSpeechQueue();
        await this._delegate.collapseButtons();
        return super.presentExample.apply(this, arguments);
    }
}
MainConversation.prototype.$rpcMethods = ['start', 'handleCommand', 'handleParsedCommand', 'handleThingTalk'];

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
OtherConversation.prototype.$rpcMethods = ['start', 'handleCommand', 'handleParsedCommand', 'handleThingTalk'];

module.exports = class Assistant extends events.EventEmitter {
    constructor(engine) {
        super();

        this._engine = engine;
        this._conversations = {};
        this._lastConversation = null;

        this._api = new AlmondApi(this._engine);
        this._conversations['api'] = this._api;
    }

    parse(sentence, targetJson) {
        return this._api.parse(sentence, targetJson);
    }
    createApp(data) {
        return this._api.createApp(data);
    }
    addOutput(out) {
        this._api.addOutput(out);
    }
    removeOutput(out) {
        this._api.removeOutput(out);
        out.$free();
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

    getConversation(id) {
        if (id !== undefined && this._conversations[id])
            return this._conversations[id];
        else
            return this._lastConversation;
    }

    getOrOpenConversation(id, user, delegate, options) {
        if (this._conversations[id]) {
            this._conversations[id]._delegate = delegate;
            return Promise.resolve(this._conversations[id]);
        }
        options = options || {};
        options.sempreUrl = Config.NL_SERVER_URL;
        let conv = this.openConversation(id, user, delegate, options);
        return Promise.resolve(conv.start()).then(() => conv);
    }

    openConversation(convId, user, delegate, options) {
        if (this._conversations[convId]) {
            this._conversations[convId].$free();
            delete this._conversations[convId];
        }
        options = options || {};
        options.sempreUrl = Config.NL_SERVER_URL;
        let conv;
        if (convId === 'main')
            conv = new MainConversation(this._engine, convId, user, delegate, options);
        else
            conv = new OtherConversation(this._engine, convId, user, delegate, options);
        conv.on('active', () => this._lastConversation = conv);
        this._lastConversation = conv;
        this._conversations[convId] = conv;
        return conv;
    }

    closeConversation(feedId) {
        if (this._conversations[feedId])
            this._conversations[feedId].$free();
        if (this._conversations[feedId] === this._lastConversation)
            this._lastConversation = null;
        delete this._conversations[feedId];
    }
};
module.exports.prototype.$rpcMethods = ['openConversation', 'closeConversation', 'getConversation', 'getOrOpenConversation', 'parse', 'createApp', 'addOutput', 'removeOutput'];
