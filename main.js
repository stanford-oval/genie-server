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

const WebFrontend = require('./service/frontend');
const EngineManager = require('./service/enginemanager');
const AssistantDispatcher = require('./service/assistant');

let _enginemanager, _frontend, _ad;

function handleSignal() {
    _frontend.close().then(() => {
        _enginemanager.stop();
        _ad.stop();
        process.exit();
    });
}


function main() {
    global.platform = require('./service/platform');
    platform.init();

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    _frontend = new WebFrontend();
    _frontend.open();

    _enginemanager = new EngineManager();
    _enginemanager.start();

    _ad = new AssistantDispatcher(_enginemanager);
    _ad.start();

    /*if (Config.ENABLE_DB_ENCRYPTION) {
        _waitReady = new Promise((callback, errback) => {
            _frontend.on('unlock', (key) => {
                console.log('Attempting unlock...');
                if (DEBUG)
                    console.log('Unlock key: ' + key.toString('hex'));
                global.platform._setSqliteKey(key);
                callback(init());
            });
        });
    } else {
        _waitReady = init();
    }


    Q(_waitReady).then(() => {
        if (_stopped)
            return Promise.resolve();
        return _engine.run();
    }).catch((error) => {
        console.log('Uncaught exception: ' + error.message);
        console.log(error.stack);
    }).finally(() => {
        _ad.stop();
        return _engine.close();
    }).catch((error) => {
        console.log('Exception during stop: ' + error.message);
        console.log(error.stack);
    }).finally(() => {
        console.log('Cleaning up');
        platform.exit();
    });*/
}

main();
