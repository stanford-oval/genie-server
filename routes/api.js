// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const express = require('express');
const crypto = require('crypto');

const user = require('../util/user');

function makeRandom(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

var router = express.Router();

router.use('/', user.requireLogIn);

class WebsocketAssistantDelegate {
    constructor(ws) {
        this._ws = ws;
    }

    send(text, icon) {
        return this._ws.send(JSON.stringify({ type: 'text', text: text, icon: icon }));
    }

    sendPicture(url, icon) {
        return this._ws.send(JSON.stringify({ type: 'picture', url: url, icon: icon }));
    }

    sendRDL(rdl, icon) {
        return this._ws.send(JSON.stringify({ type: 'rdl', rdl: rdl, icon: icon }));
    }

    sendChoice(idx, what, title, text) {
        return this._ws.send(JSON.stringify({ type: 'choice', idx: idx, title: title, text: text }));
    }

    sendButton(title, json) {
        return this._ws.send(JSON.stringify({ type: 'button', title: title, json: json }));
    }

    sendLink(title, url) {
        return this._ws.send(JSON.stringify({ type: 'link', title: title, url: url }));
    }

    sendAskSpecial(what) {
        return this._ws.send(JSON.stringify({ type: 'askSpecial', ask: what }));
    }

    sendHypothesis(hypothesis) {
        return this._ws.send(JSON.stringify({ type: 'hypothesis', hypothesis: hypothesis }));
    }

    sendCommand(command) {
        return this._ws.send(JSON.stringify({ type: 'command', text: command }));
    }
}

router.ws('/conversation', (ws, req, next) => {
    const engine = req.app.engine;
    const assistant = engine.platform.getCapability('assistant');

    const delegate = new WebsocketAssistantDelegate(ws);
    const isMain = req.host === '127.0.0.1';

    let opened = false;
    const id = 'web-' + makeRandom(16);
    ws.on('error', (err) => {
        ws.close();
    });
    ws.on('close', () => {
        if (opened) {
            if (isMain)
                conversation.removeOutput(delegate);
            else
                assistant.closeConversation(id);
        }
        opened = false;
    });

    let conversation;
    if (isMain) {
        conversation = assistant.getConversation('main');
        conversation.addOutput(delegate);
        opened = true;
    } else {
        conversation = assistant.openConversation(id, delegate);
        opened = true;
        conversation.start();
    }

    ws.on('message', (data) => {
        Q.try(() => {
            const parsed = JSON.parse(data);
            switch(parsed.type) {
            case 'command':
                return conversation.handleCommand(parsed.text);
            case 'parsed':
                return conversation.handleParsedCommand(parsed.json, parsed.title);
            case 'tt':
                return conversation.handleThingTalk(parsed.code);
            default:
                throw new Error('Invalid command type ' + parsed.type);
            }
        }).catch((e) => {
            console.error(e.stack);
            ws.send(JSON.stringify({ type: 'error', error:e.message }));
        });
    });
});

module.exports = router;
