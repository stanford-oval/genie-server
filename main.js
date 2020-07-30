// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
Q.longStackSupport = true;
process.on('unhandledRejection', (up) => { throw up; });

const child_process = require('child_process');
let canberra;
try {
    canberra = require('canberra');
} catch(e) {
    canberra = null;
}

const Genie = require('genie-toolkit');
const WebFrontend = require('./service/frontend');

const Config = require('./config');

let _stopped = false;
let _running = false;
let _engine, _frontend;

function handleStop() {
    if (_running)
        _engine.stop();
    else
        _stopped = true;
}

const DEBUG = false;
const LOCAL_USER = {
    id: process.getuid ? process.getuid() : 0,
    account: '', //pwnam.name;
    name: '', //pwnam.gecos;
};

const HOTWORD_DETECTED_ID = 1;
async function init(platform) {
    _engine = new Genie.AssistantEngine(platform, {
        cloudSyncUrl: Config.CLOUD_SYNC_URL,
        thingpediaUrl: Config.THINGPEDIA_URL,
        nluModelUrl: Config.SEMPRE_URL,
    });
    _frontend.setEngine(_engine);

    await _engine.open();

    const conversation = _engine.assistant.openConversation('main', LOCAL_USER, {
        showWelcome: true,
        debug: true,
        deleteWhenInactive: false,
        inactivityTimeout: 30000, // pick a low inactivity timeout to turn off the microphone
        contextResetTimeout: 600000, // but only reset the timeout after 10 minutes (the default)
    });

    if (platform.hasCapability('sound')) {
        const speech = new Genie.SpeechHandler(conversation, platform, {
            subscriptionKey: Config.MS_SPEECH_RECOGNITION_PRIMARY_KEY
        });

        speech.on('wakeword', (hotword) => {
            child_process.spawn('xset', ['dpms', 'force', 'on']).on('error', (err) => {
                console.error(`Failed to wake up the screen: ${err.message}`);
            });
        });

        if (canberra) {
            const eventSoundCtx = new canberra.Context({
                [canberra.Property.APPLICATION_ID]: 'edu.stanford.Almond',
            });
            eventSoundCtx.cache({
                [canberra.Property.EVENT_ID]: 'message-new-instant'
            });

            speech.on('wakeword', (hotword) => {
                eventSoundCtx.play(HOTWORD_DETECTED_ID, {
                    [canberra.Property.EVENT_ID]: 'message-new-instant'
                }).catch((e) => {
                    console.error(`Failed to play hotword detection sound: ${e.message}`);
                });
            });
        }

        speech.start();
    }
    await conversation.start();
}

async function main() {
    process.on('SIGINT', handleStop);
    process.on('SIGTERM', handleStop);

    const platform = require('./service/platform');
    try {

        _frontend = new WebFrontend(platform);

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
