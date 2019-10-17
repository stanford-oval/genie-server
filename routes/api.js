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

const express = require('express');
const crypto = require('crypto');

const user = require('../util/user');

const Config = require('../config');

function makeRandom(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

var router = express.Router();

router.use('/', (req, res, next) => {
    const compareTo = req.protocol + '://' + req.hostname + ':' + req.app.get('port');
    if (req.headers.origin && req.headers.origin !== compareTo) {
        res.status(403).send('Forbidden Cross Origin Request');
        return;
    }

    next();
}, user.requireLogIn);

router.get('/parse', (req, res, next) => {
    let query = req.query.q || null;
    if (!query) {
        res.status(400).json({error:'Missing query'});
        return;
    }

    const engine = req.app.engine;
    const assistant = engine.platform.getCapability('assistant');
    Promise.resolve().then(() => {
        return assistant.parse(query);
    }).then((result) => {
        res.json(result);
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});

router.post('/converse', (req, res, next) => {
    let command = req.body.command;
    if (!command) {
        res.status(400).json({error:'Missing command'});
        return;
    }

    const engine = req.app.engine;
    const assistant = engine.platform.getCapability('assistant');
    Promise.resolve().then(() => {
        return assistant.converse(command);
    }).then((result) => {
        res.json(result);
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});

function describeApp(app) {
    return {
        uniqueId: app.uniqueId,
        description: app.description,
        error: app.error,
        code: app.code,
        icon: app.icon ? Config.THINGPEDIA_URL + '/api/devices/icon/' + app.icon : null
    };
}

router.post('/apps/create', (req, res, next) => {
    const engine = req.app.engine;
    const assistant = engine.platform.getCapability('assistant');

    Promise.resolve().then(() => {
        return assistant.createApp(req.body);
    }).then((result) => {
        if (result.error)
            res.status(400);
        res.json(result);
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});

router.get('/apps/list', (req, res, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        return engine.apps.getAllApps();
    }).then((apps) => {
        res.json(apps.map(describeApp));
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});

router.get('/apps/get/:appId', (req, res, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        return engine.apps.getApp(req.params.appId);
    }).then((app) => {
        if (!app) {
            res.status(404);
            return { error: 'No such app' };
        } else {
            return describeApp(app);
        }
    }).then((result) => {
        res.json(result);
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});

router.post('/apps/delete/:appId', (req, res, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        return engine.apps.getApp(req.params.appId);
    }).then((app) => {
        if (!app) {
            res.status(404);
            return { error: 'No such app' };
        } else {
            return Promise.resolve(engine.apps.removeApp(app)).then(() => ({status:'ok'}));
        }
    }).then((result) => {
        res.json(result);
    }).catch((e) => {
        console.error(e.stack);
        res.status(500).json({error:e.message});
    });
});

router.ws('/results', (ws, req, next) => {
    const engine = req.app.engine;
    const assistant = engine.platform.getCapability('assistant');

    Promise.resolve().then(() => {
        ws.on('close', () => {
            assistant.removeOutput(ws);
        });
        ws.on('ping', (data) => ws.pong(data));

        return assistant.addOutput(ws);
    }).catch((error) => {
        console.error('Error in API websocket: ' + error.message);
        ws.close();
    });
});

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
        console.error(err);
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
        Promise.resolve().then(() => {
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
