// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
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

import express from 'express';
import passport from 'passport';
import * as Genie from 'genie-toolkit';
import WebSocket from 'ws';

import * as user from '../util/user';
import * as errorHandling from '../util/error_handling';
import { makeRandom } from '../util/random';

import conversationHandler from './conversation';

const router = express.Router();

router.use('/', (req, res, next) => {
    if (req.user) {
        next();
        return;
    }
    passport.authenticate('bearer')(req, res, next);
 }, user.requireLogIn);

router.post('/converse', (req, res, next) => {
    const command = req.body.command;
    if (!command) {
        res.status(400).json({error:'Missing command'});
        return;
    }

    const engine = req.app.genie;
    const assistant = engine.assistant;
    Promise.resolve().then(() => {
        return assistant.converse(command, req.body.conversationId ? String(req.body.conversationId) : 'stateless-' + makeRandom(4));
    }).then((result) => {
        res.json(result);
    }).catch(next);
});

router.get('/devices/list', (req, res, next) => {
    const engine = req.app.genie;
    Promise.resolve().then(() => {
        const result = engine.getDeviceInfos();
        // sort by name to provide a deterministic result
        result.sort((a, b) => a.name.localeCompare(b.name));
        res.json(result);
    }).catch(next);
});

router.post('/devices/create', (req, res, next) => {
    const engine = req.app.genie;
    Promise.resolve().then(async () => {
        const device = await engine.devices.addSerialized(req.body);
        res.json(engine.getDeviceInfo(device.uniqueId!));
    }).catch(next);
});


router.post('/apps/create', (req, res, next) => {
    const engine = req.app.genie;
    Promise.resolve().then(() => {
        return engine.createAppAndReturnResults(req.body.code);
    }).then((result) => {
        if (result.errors && result.errors.length)
            res.status(400);
        if (result.icon)
            result.icon = 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/' + result.icon;
        res.json(result);
    }).catch(next);
});

router.get('/apps/list', (req, res, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        res.json(engine.getAppInfos());
    }).catch(next);
});

router.get('/apps/get/:appId', (req, res, next) => {
    const engine = req.app.genie;

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
    const engine = req.app.genie;

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
    private _dispatcher : Genie.DialogueAgent.AssistantDispatcher;
    private _ws : WebSocket;

    constructor(engine : Genie.AssistantEngine, ws : WebSocket) {
        this._dispatcher = engine.assistant;
        this._ws = ws;
        this._dispatcher.addNotificationOutput(this);
    }

    destroy() {
        this._dispatcher.removeNotificationOutput(this);
    }

    async notify(data : Parameters<Genie.DialogueAgent.NotificationDelegate['notify']>[0]) {
        if (data.icon)
            data.icon = 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/' + data.icon;
        await this._ws.send(JSON.stringify({ result: data }));
    }

    async notifyError(data : Parameters<Genie.DialogueAgent.NotificationDelegate['notifyError']>[0]) {
        if (data.icon)
            data.icon = 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/' + data.icon;
        await this._ws.send(JSON.stringify({ error: data }));
    }
}

router.ws('/results', (ws, req, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        const wrapper = new NotificationWrapper(engine, ws);
        ws.on('close', () => {
            wrapper.destroy();
        });
        ws.on('ping', (data) => ws.pong(data));
    }).catch((error) => {
        console.error('Error in API websocket: ' + error.message);
        ws.close();
    });
});

router.ws('/conversation', conversationHandler);

// if nothing handled the route, return a 404
router.use('/', (req, res) => {
    res.status(404).json({ error: 'Invalid endpoint' });
});

// if something failed, return a 500 in json form, or the appropriate status code
router.use(errorHandling.json);

export default router;
