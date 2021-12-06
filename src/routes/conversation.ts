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
import * as Genie from 'genie-toolkit';
import WebSocket from 'ws';

export default function conversationHandler(ws : WebSocket, req : express.Request, next : express.NextFunction) {
    Promise.resolve().then(async () => {
        const engine = req.app.genie;

        let opened = false;
        const conversationId = String(req.query.id || 'main');
        ws.on('error', (err) => {
            console.error(err);
            ws.close();
        });
        ws.on('close', () => {
            if (opened)
                wrapper.destroy();
            opened = false;
        });

        let initQueue : any[] = [];
        ws.on('message', (data) => {
            Promise.resolve().then(async () => {
                const parsed = JSON.parse(String(data));
                if (opened)
                    await wrapper.handle(parsed);
                else
                    initQueue.push(parsed);
            }).catch((e) => {
                // either the message didn't parse as json, or we had an error sending the error
                // (ie the websocket is closed)
                // eat the error and close the socket
                ws.terminate();
            });
        });
        const conversation = await engine.assistant.getOrOpenConversation(conversationId, {
            showWelcome: true,
            debug: true,
            log: true
        });
        const wrapper = new Genie.DialogueAgent.Protocol.WebSocketConnection(conversation, async (msg) => ws.send(JSON.stringify(msg)), {
            syncDevices: !!req.query.sync_devices,
            replayHistory: !req.query.skip_history
        });
        await wrapper.start();
        for (const msg of initQueue)
            await wrapper.handle(msg);
        opened = true;
        initQueue = [];

    }).catch((e) => {
        console.error('Error in API websocket: ' + e.message);
        ws.terminate();
    });
}
