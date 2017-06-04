// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');
const crypto = require('crypto');
const passport = require('passport');
const posix = require('posix');

const Config = require('../config');

const user = require('../util/user');

function makeRandom(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

class LocalUser {
    constructor() {
        var pwnam = posix.getpwnam(process.getuid());

        this.id = process.getuid();
        this.account = pwnam.name;
        this.name = pwnam.gecos;
    }
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
}

router.ws('/conversation', function(ws, req, next) {
    var engine = req.app.engine;
    var assistant = engine.platform.getCapability('assistant');

    var assistantUser = new LocalUser();
    var delegate = new WebsocketAssistantDelegate(ws);

    var opened = false;
    const id = 'web-' + makeRandom(16);
    ws.on('error', (err) => {
        ws.close();
    });
    ws.on('close', () => {
        if (opened)
            assistant.closeConversation(id); // ignore errors if engine died
        opened = false;
    });

    var conversation = assistant.openConversation(id, assistantUser, delegate, {
        sempreUrl: Config.SEMPRE_URL,
        showWelcome: true
    });
    opened = true;
    conversation.start();

    ws.on('message', (data) => {
        Q.try(() => {
            var parsed = JSON.parse(data);
            switch(parsed.type) {
            case 'command':
                return conversation.handleCommand(parsed.text);
                break;
            case 'parsed':
                return conversation.handleParsedCommand(parsed.json);
                break;
            }
        }).catch((e) => {
            console.error(e.stack);
            ws.send(JSON.stringify({ type: 'error', error:e.message }));
        });
    });
});

module.exports = router;
