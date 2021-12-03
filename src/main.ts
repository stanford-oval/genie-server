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

process.on('unhandledRejection', (up) => { throw up; });

import * as Genie from 'genie-toolkit';
import which from 'which';
import * as fs from 'fs';

import WebFrontend from './frontend';
import type { ServerPlatform } from './service/platform';
import platform from './service/platform';
import ClientManager from './service/client-manager';

import * as Config from './config';

let _stopped = false;
let _running = false;
let _engine : Genie.AssistantEngine,
    _frontend : WebFrontend,
    _clientManager : ClientManager;

function handleStop() {
    if (_running)
        _engine.stop();
    else
        _stopped = true;
}

const DEBUG = false;

async function init(platform : ServerPlatform) {
    _engine = new Genie.AssistantEngine(platform, {
        cloudSyncUrl: Config.CLOUD_SYNC_URL,
        thingpediaUrl: Config.THINGPEDIA_URL,
        nluModelUrl: Config.NLP_URL,
    });
    _frontend.setEngine(_engine);

    await _engine.open();
    await _engine.assistant.getOrOpenConversation('main', Config.CONVERSATION_OPTIONS);
}

function spawnClient() {
    if (!process.env.PULSE_SERVER && !fs.existsSync(process.env.XDG_RUNTIME_DIR + '/pulse/native')) {
        console.log('Skipping audio because PulseAudio is not available');
        return;
    }

    which('genie-client', (err, resolved) => {
        if (err) {
            console.log(`Skipping audio because genie-client-cpp is not found: ${err}`);
            return;
        }

        // great, we found it!
        _clientManager = new ClientManager(Number(process.env.PORT || 3000));
        _clientManager.start().catch((e) => {
            console.error(`Failed to spawn genie-client-cpp: ${e}`);
        });
    });
}

async function main() {
    process.on('SIGINT', handleStop);
    process.on('SIGTERM', handleStop);

    try {
        _frontend = new WebFrontend(platform);
        await _frontend.init();

        if (Config.ENABLE_DB_ENCRYPTION) {
            await _frontend.open();
            await new Promise((resolve, reject) => {
                _frontend.on('unlock', (key) => {
                    console.log('Attempting unlock...');
                    if (DEBUG)
                        console.log('Unlock key: ' + key.toString('hex'));
                    platform._setSqliteKey(key);
                    resolve(init(platform));
                });
            });
        } else {
            await init(platform);
            await _frontend.open();
        }

        try {
            console.log('Ready');
            if (!_stopped) {
                _running = true;
                spawnClient();
                await _engine.run();
            }
        } finally {
            if (_clientManager)
                _clientManager.stop();
            try {
                await _engine.close();
            } catch(error) {
                console.log('Exception during stop: ' + error.message);
                console.log(error.stack);
            }
        }
    } catch(error) {
        console.error('Uncaught exception: ' + error.message);
        console.error(error.stack);
    } finally {
        console.log('Cleaning up');
        platform.exit();
    }
}

main();
