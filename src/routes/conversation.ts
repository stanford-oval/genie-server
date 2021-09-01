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
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>

import express from 'express';
import * as Genie from 'genie-toolkit';
import * as Tp from 'thingpedia';
import WebSocket from 'ws';

class WebsocketAssistantDelegate implements Genie.DialogueAgent.ConversationDelegate {
    private _ws : WebSocket;

    constructor(ws : WebSocket) {
        this._ws = ws;
    }

    async setHypothesis() {
        // voice doesn't go through SpeechHandler, hence hypotheses don't go through here!
    }

    async setExpected(what : string|null) {
        this._ws.send(JSON.stringify({ type: 'askSpecial', ask: what }));
    }

    async addDevice(uniqueId : string, state : Tp.BaseDevice.DeviceState) {
        this._ws.send(JSON.stringify({ type: 'new-device', uniqueId, state }));
    }

    async addMessage(msg : Genie.DialogueAgent.Protocol.Message) {
        this._ws.send(JSON.stringify(msg));
    }
}

export default function conversationHandler(ws : WebSocket, req : express.Request, next : express.NextFunction) {
    Promise.resolve().then(async () => {
        const engine = req.app.genie;

        const delegate = new WebsocketAssistantDelegate(ws);

        let opened = false;
        const conversationId = String(req.query.id || 'main');
        ws.on('error', (err) => {
            console.error(err);
            ws.close();
        });
        ws.on('close', () => {
            if (opened)
                conversation.removeOutput(delegate);
            opened = false;
        });
        const conversation = await engine.assistant.getOrOpenConversation(conversationId, {
            showWelcome: true,
            debug: true,
        });
        await conversation.addOutput(delegate, true);
        await conversation.startRecording();
        opened = true;
        ws.send(JSON.stringify({ type: 'id', id : conversation.id }));

        ws.on('message', (data) => {
            Promise.resolve().then(() => {
                const parsed = JSON.parse(String(data));
                switch (parsed.type) {
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
}
