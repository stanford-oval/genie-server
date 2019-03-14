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

// load and assign config first
const Config = require('./config');
try {
    Object.assign(Config, require('./secret_config'));
} catch(e) { /* ignore errors */ }

const Engine = require('thingengine-core');
const WebFrontend = require('./service/frontend');
const AssistantDispatcher = require('./service/assistant');

let _waitReady;
let _stopped = false;
let _engine, _frontend, _ad;

const DEBUG = false;

function main() {
    global.platform = require('./service/platform');

    global.platform.init();

    _frontend = new WebFrontend(global.platform);

    function init() {
        _engine = new Engine(global.platform, { thingpediaUrl: Config.THINGPEDIA_URL });
        _frontend.setEngine(_engine);

        _ad = new AssistantDispatcher(_engine);
        global.platform.setAssistant(_ad);
        return _engine.open().then(() => {
            return _ad.start();
        });
    }

    if (Config.ENABLE_DB_ENCRYPTION) {
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
    _frontend.open();

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
    });
}

main();
