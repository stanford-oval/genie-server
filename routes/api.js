// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016-2020 The Board of Trustees of the Leland Stanford Junior University
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
"use strict";

const express = require('express');
const crypto = require('crypto');
const ThingTalk = require('thingtalk');

const user = require('../util/user');
const errorHandling = require('../util/error_handling');

const Config = require('../config');

function makeRandom(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

var router = express.Router();

router.use('/', (req, res, next) => {
    const compareTo = req.app.engine.platform.getOrigin();
    if (req.headers.origin && req.headers.origin !== compareTo) {
        res.status(403).send('Forbidden Cross Origin Request');
        return;
    }

    next();
}, user.requireLogIn);

router.post('/converse', (req, res, next) => {
    const command = req.body.command;
    if (!command) {
        res.status(400).json({error:'Missing command'});
        return;
    }

    const engine = req.app.engine;
    const assistant = engine.assistant;
    Promise.resolve().then(() => {
        return assistant.converse(command);
    }).then((result) => {
        res.json(result);
    }).catch(next);
});

router.get('/devices/list', (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(() => {
        const result = engine.getDeviceInfos();
        // sort by name to provide a deterministic result
        result.sort((a, b) => a.name.localeCompare(b.name));
        res.json(result);
    }).catch(next);
});

router.post('/devices/create', (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        const device = await engine.devices.addSerialized(req.body);
        res.json(engine.getDeviceInfo(device.uniqueId));
    }).catch(next);
});

async function createAppAndReturnResults(engine, data) {
    const app = await engine.createApp(data.code);
    const results = [];
    const errors = [];

    const formatter = new ThingTalk.Formatter(engine.platform.locale, engine.platform.timezone, engine.schemas);
    for await (const value of app.mainOutput) {
        if (value instanceof Error) {
            errors.push(value);
        } else {
            const messages = await formatter.formatForType(value.outputType, value.outputValue, 'messages');
            results.push({ raw: value.outputValue, type: value.outputType, formatted: messages });
        }
    }

    return {
        uniqueId: app.uniqueId,
        description: app.description,
        code: app.code,
        icon: app.icon ? Config.THINGPEDIA_URL + '/api/devices/icon/' + app.icon : app.icon,
        results, errors
    };
}

router.post('/apps/create', (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(() => {
        return createAppAndReturnResults(engine, req.body);
    }).then((result) => {
        if (result.error)
            res.status(400);
        res.json(result);
    }).catch(next);
});

router.get('/apps/list', (req, res, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        res.json(engine.getAppInfo());
    }).catch(next);
});

router.get('/apps/get/:appId', (req, res, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        return engine.getAppInfo(req.params.appId, false);
    }).then((app) => {
        if (!app) {
            res.status(404);
            res.json({ error: 'No such app' });
        } else {
            res.json(app);
        }
    }).catch(next);
});

router.post('/apps/delete/:appId', (req, res, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        return engine.deleteApp(req.params.appId);
    }).then((deleted) => {
        if (!deleted) {
            res.status(404);
            return res.json({ error: 'No such app' });
        } else {
            return res.json({ status:'ok' });
        }
    }).catch(next);
});


class NotificationWrapper {
    constructor(engine, ws) {
        this._dispatcher = engine.assistant;
        this._ws = ws;
        this._formatter = new ThingTalk.Formatter(engine.platform.locale, engine.platform.timezone, engine.schemas);
        this._dispatcher.addNotificationOutput(this);
    }

    destroy() {
        this._dispatcher.removeNotificationOutput(this);
    }

    async notify(appId, icon, outputType, outputValue) {
        const messages = await this._formatter.formatForType(outputType, outputValue, 'messages');
        await this._ws.send(JSON.stringify({
            result: {
                appId: appId,
                icon: icon ? Config.THINGPEDIA_URL + '/api/devices/icon/' + icon : null,
                raw: outputValue,
                type: outputType,
                formatted: messages
            }
        }));
    }

    async notifyError(appId, icon, error) {
        await this._ws.send(JSON.stringify({
            error: {
                appId: appId,
                icon: icon ? Config.THINGPEDIA_URL + '/api/devices/icon/' + icon : null,
                error: error
            }
        }));
    }
}

router.ws('/results', (ws, req, next) => {
    const engine = req.app.engine;

    Promise.resolve().then(() => {
        const wrapper = new NotificationWrapper(engine, ws);
        ws.on('close', () => {
            wrapper.destroy(ws);
        });
        ws.on('ping', (data) => ws.pong(data));
    }).catch((error) => {
        console.error('Error in API websocket: ' + error.message);
        ws.close();
    });
});


class WebsocketAssistantDelegate {
    constructor(ws) {
        this._ws = ws;
    }

    setHypothesis() {
        // voice doesn't go through SpeechHandler, hence hypotheses don't go through here!
    }

    setExpected(what) {
        this._ws.send(JSON.stringify({ type: 'askSpecial', ask: what }));
    }

    addMessage(msg) {
        this._ws.send(JSON.stringify(msg));
    }
}

const LOCAL_USER = {
    id: process.getuid ? process.getuid() : 0,
    account: '', //pwnam.name;
    name: '', //pwnam.gecos;
};

router.ws('/conversation', (ws, req, next) => {
    Promise.resolve().then(async () => {
        const engine = req.app.engine;

        const delegate = new WebsocketAssistantDelegate(ws);
        const isMain = req.host === '127.0.0.1';

        let opened = false;
        const conversationId = isMain ? 'main' : (req.query.conversationId || 'web-' + makeRandom(16));
        ws.on('error', (err) => {
            console.error(err);
            ws.close();
        });
        ws.on('close', () => {
            if (opened)
                conversation.removeOutput(delegate);
            opened = false;
        });

        const conversation = await engine.assistant.getOrOpenConversation(conversationId, LOCAL_USER, {
            showWelcome: true,
            debug: true,
        });
        await conversation.addOutput(delegate, true);
        opened = true;

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
    }).catch((e) => {
        console.error('Error in API websocket: ' + e.message);
        ws.close();
    });
});

// if nothing handled the route, return a 404
router.use('/', (req, res) => {
    res.status(404).json({ error: 'Invalid endpoint' });
});

// if something failed, return a 500 in json form, or the appropriate status code
router.use(errorHandling.json);

module.exports = router;
