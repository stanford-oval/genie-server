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

import * as child_process from 'child_process';
import * as Genie from 'genie-toolkit';
import * as stream from 'stream';

import WebFrontend from './frontend';
import type { ServerPlatform, SoundEffectsApi } from './service/platform';
import platform from './service/platform';

import * as Config from './config';

let _stopped = false;
let _running = false;
let _engine : Genie.AssistantEngine, _frontend : WebFrontend;

function handleStop() {
    if (_running)
        _engine.stop();
    else
        _stopped = true;
}

const DEBUG = false;

const HOTWORD_DETECTED_ID = 1;
async function init(platform : ServerPlatform) {
    _engine = new Genie.AssistantEngine(platform, {
        cloudSyncUrl: Config.CLOUD_SYNC_URL,
        thingpediaUrl: Config.THINGPEDIA_URL,
        nluModelUrl: Config.NLP_URL,
    });
    _frontend.setEngine(_engine);

    await _engine.open();

    const conversation = _engine.assistant.openConversation('main', {
        showWelcome: true,
        debug: true,
        deleteWhenInactive: false,
        inactivityTimeout: 30000, // pick a low inactivity timeout to turn off the microphone
        contextResetTimeout: 30000,
    });

    if (platform.hasCapability('sound')) {
        const speech = new Genie.SpeechHandler(conversation, platform, {
            subscriptionKey: Config.MS_SPEECH_RECOGNITION_PRIMARY_KEY
        });
        platform.speech = speech;

        let play : stream.Writable|null;
        const ensureNullPlayback = () => {
            if (play)
                return;
            play = platform.getCapability('sound')!.createPlaybackStream({
                format: 'S16LE',
                rate: 16000,
                channels: 1,
                stream: 'genie-voice-null',
                properties: {
                    'media.role': 'voice-assistant',
                    'filter.want': 'echo-cancel',
                }
            });
        };

        const stopNullPlayback = () => {
            if (play) {
                play.end();
                play = null;
            }
        };

        speech.on('wakeword', (hotword) => {
            child_process.spawn('xset', ['dpms', 'force', 'on']).on('error', (err) => {
                console.error(`Failed to wake up the screen: ${err.message}`);
            });
            ensureNullPlayback();
         });

        speech.on('no-match', stopNullPlayback);
        speech.on('match', stopNullPlayback);

        const soundEffects = platform.getCapability('sound-effects') as SoundEffectsApi;
        if (soundEffects) {
            speech.on('wakeword', (hotword) => {
                soundEffects.play('message-new-instant', HOTWORD_DETECTED_ID).catch((e : Error) => {
                    console.error(`Failed to play hotword detection sound: ${e.message}`);
                });
            });

            speech.on('no-match', () => {
                soundEffects.play('dialog-warning', HOTWORD_DETECTED_ID).catch((e : Error) => {
                    console.error(`Failed to play hotword no-match sound: ${e.message}`);
                });
            });
        }

        speech.start();
    }
    await conversation.start();
}

async function main() {
    await platform.init();

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
                await _engine.run();
            }
        } finally {
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
