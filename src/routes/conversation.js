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

export default function conversationHandler(ws, req, next) {
    Promise.resolve().then(async () => {
        const engine = req.app.engine;

        const delegate = new WebsocketAssistantDelegate(ws);

        let opened = false;
        const conversationId = req.query.id || 'main';
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
                const parsed = JSON.parse(data);
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
