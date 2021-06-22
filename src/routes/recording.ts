// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
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
// Author: Silei Xu <silei@cs.stanford.edu>

import express from 'express';

import * as user from '../util/user';

const router = express.Router();

router.use(user.requireLogIn);

router.post('/start', (req, res, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        return engine.assistant.getConversation(req.body.id);
    }).then((conversation) => {
        if (!conversation) {
            res.status(404);
            return res.json({ error: 'No conversation found' });
        } else {
            conversation.startRecording();
            return res.json({ status: 'ok' });
        }
    }).catch(next);
});

router.post('/stop', (req, res, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        return engine.assistant.getConversation(req.body.id);
    }).then((conversation) => {
        if (!conversation) {
            res.status(404);
            return res.json({ error: 'No conversation found' });
        } else {
            conversation.endRecording();
            return res.json({ status:'ok' });
        }
    }).catch(next);
});

router.get('/status/:id', (req, res, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        return engine.assistant.getConversation(req.params.id);
    }).then((conversation) => {
        if (!conversation) {
            res.status(404);
            res.json({ error: 'No conversation found' });
        } else {
            res.json({ status: conversation.inRecordingMode ? 'on' : 'off' });
        }
    }).catch(next);
});

router.post('/vote/:vote', (req, res, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        return engine.assistant.getConversation(req.body.id);
    }).then((conversation) => {
        if (req.params.vote !== 'up' && req.params.vote !== 'down') {
            res.status(400);
            return res.json({ error: 'Invalid voting option' });
        } else if (!conversation) {
            res.status(404);
            return res.json({ error: 'No conversation found' });
        } else {
            conversation.voteLast(req.params.vote);
            return res.json({ status:'ok' });
        }
    }).catch(next);
});

router.post('/comment', (req, res, next) => {
    const engine = req.app.genie;
    const command = req.body.comment;
    if (!command) {
        res.status(400).json({ error: 'Missing comment' });
        return;
    }

    Promise.resolve().then(() => {
        return engine.assistant.getConversation(req.body.id);
    }).then((conversation) => {
        if (!conversation) {
            res.status(404);
            return res.json({ error: 'No conversation found' });
        } else {
            conversation.commentLast(req.body.comment);
            return res.json({ status:'ok' });
        }
    }).catch(next);
});

router.get('/log/:id.txt', (req, res, next) => {
    const engine = req.app.genie;

    Promise.resolve().then(() => {
        const conversation = engine.assistant.getConversation((req.params as any).id);
        if (!conversation) {
            res.status(404);
            res.send('No conversation found');
            return;
        }

        res.set('Content-Type', 'text/plain');
        res.set('Content-Disposition', `attachment; filename="log-${conversation.id}.txt"`);
        conversation.readLog().pipe(res);
    }).catch(next);
});


export default router;
