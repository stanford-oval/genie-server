// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
Q.longStackSupport = true;

const Engine = require('thingengine-core');
const WebFrontend = require('./service/frontend');
const AssistantDispatcher = require('./service/assistant');

const Config = require('./config');

let _waitReady;
let _stopped = false;
let _engine, _frontend, _ad;

const DEBUG = false;

function main() {
    global.platform = require('./service/platform');

    global.platform.init();

    _frontend = new WebFrontend(global.platform);

    function init() {
        _engine = new Engine(global.platform);
        _frontend.setEngine(_engine);

        _ad = new AssistantDispatcher(_engine);
        global.platform.setAssistant(_ad);
        return _engine.open().then(() => {
            return _ad.start();
        });
    }

    if (Config.ENABLE_DB_ENCRYPTION) {
        _waitReady = new Q.Promise((callback, errback) => {
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

    _waitReady.then(function() {
        _running = true;
        if (_stopped)
            return;
        return _engine.run();
    }).catch(function(error) {
        console.log('Uncaught exception: ' + error.message);
        console.log(error.stack);
    }).finally(function() {
        _ad.stop();
        return _engine.close();
    }).catch(function(error) {
        console.log('Exception during stop: ' + error.message);
        console.log(error.stack);
    }).finally(function() {
        console.log('Cleaning up');
        platform.exit();
    });
}

main();
