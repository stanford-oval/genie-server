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
import multer from 'multer';
import * as os from 'os';
// import * as I18n from "../util/i18n";
// import {SpeechToText}  from "../util/backend-microsoft";
import * as fs from 'fs';
import speech from '@google-cloud/speech';

import passport from 'passport';
import * as Genie from 'genie-toolkit';
import WebSocket from 'ws';

import * as user from '../util/user';
import * as errorHandling from '../util/error_handling';
import { makeRandom } from '../util/random';

import conversationHandler from './conversation';

const router = express.Router();

const upload = multer({ dest: os.tmpdir() });

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

async function restSTT(
    req : express.Request,
    res : express.Response,
    next : express.NextFunction
) {
    
    if (!req.file) {
        // iv.failKey(req, res, "audio", { json: true });
        res.json({
            status: "ok",
            text: "req.file is undefined",
        });
        return;
    }
    // if (!I18n.get(req.params.locale, false)) {
    //     res.status(404).json({ error: "Unsupported language" });
    //     return;
    // }

    // const stt = new SpeechToText(req.params.locale);
    // stt.recognizeOnce(req.file.path)
    //     .then((text) => {
    //         res.json({
    //             result: "ok",
    //             text: text,
    //         });
    //     })
    //     .catch(next);

    // const speech = require('@google-cloud/speech');

    // Creates a client
    const client = new speech.SpeechClient();

    const filename = req.file.path;
    // const encoding = 'LINEAR16'; // encoding can be omitted if the file format is wav
    const sampleRateHertz = 48000; // default wav sample rate
    const languageCode = 'en-US';

    const config = {
        // encoding: encoding,
        sampleRateHertz: sampleRateHertz,
	languageCode: languageCode,
	"speechContexts": [{
          "phrases": ["$OOV_CLASS_DIGIT_SEQUENCE","I would like to the see air supply equipment in corridor 529","fifth floor","fifth", "corridor","air supply equipment", "user manual", "equipment", "system name", "system", "building component", "load", "display","display system","assets","asset","air supply"]
        }]
    };

    /**
     * Note that transcription is limited to 60 seconds audio.
     * Use a GCS file for audio longer than 1 minute.
     */
    const audio = {
        content: fs.readFileSync(filename).toString('base64'),
    };

    const request = {
        config: config,
        audio: audio,
    };

    // // Detects speech in the audio file. This creates a recognition job that you
    // // can wait for now, or get its result later.
    // const [operation] = await client.longRunningRecognize(request);
    // const [response] = await operation.promise();
    const [response] = await client.recognize(request);
    let transcription = '';
    if (response.results &&
        response.results[0] && 
        response.results[0].alternatives && 
        response.results[0].alternatives[0] &&
        response.results[0].alternatives[0].transcript){
            transcription = response.results[0].alternatives[0].transcript;
            console.log('Transcription: ', transcription);
        }
    
    res.json({
        status: "ok",
        text: transcription,
    });
}

router.post('/stt', upload.single("audio"), restSTT);


// if nothing handled the route, return a 404
router.use('/', (req, res) => {
    res.status(404).json({ error: 'Invalid endpoint' });
});

// if something failed, return a 500 in json form, or the appropriate status code
router.use(errorHandling.json);

export default router;
