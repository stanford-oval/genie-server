// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
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

const Engine = require('thingengine-core');
const WebFrontend = require('./service/frontend');
const AssistantDispatcher = require('./service/assistant');

const Config = require('./config');

let _stopped = false;
let _running = false;
let _engine, _frontend, _ad;

function handleStop() {
    if (_running)
        _engine.stop();
    else
        _stopped = true;
}

const DEBUG = false;

async function init(platform) {
    _engine = new Engine(platform, { thingpediaUrl: Config.THINGPEDIA_URL });
    _frontend.setEngine(_engine);

    _ad = new AssistantDispatcher(_engine);
    platform.setAssistant(_ad);
    await _engine.open();
    await _ad.start();
}

async function main() {
    process.on('SIGINT', handleStop);
    process.on('SIGTERM', handleStop);

    const platform = require('./service/platform');
    try {

        _frontend = new WebFrontend(platform);
        await _frontend.open();

        if (Config.ENABLE_DB_ENCRYPTION) {
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
        }

        try {
            console.log('Ready');
            if (!_stopped) {
                _running = true;
                await _ad.startConversation();
                await _engine.run();
            }
        } finally {
            try {
                await _ad.stop();
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
