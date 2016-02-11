// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');

const Engine = require('./engine');
const Frontend = require('./frontend/frontend');

function main() {
    Q.longStackSupport = true;

    global.platform = require('./platform');

    var test = process.argv.indexOf('--test') >= 0;
    platform.init(test).then(function() {
        var engine = new Engine();
        var frontend = new Frontend();
        platform._setFrontend(frontend);
        frontend.setEngine(engine);

        var earlyStop = false;
        var engineRunning = false;
        function handleSignal() {
            if (engineRunning)
                engine.stop();
            else
                earlyStop = true;
        }
        //process.on('SIGINT', handleSignal);
        //process.on('SIGTERM', handleSignal);

        return Q.all([engine.open(), frontend.open()]).then(function() {
            engineRunning = true;
            if (earlyStop)
                return;
            return engine.run().finally(function() {
                return Q.all([engine.close(), frontend.close()]);
            });
        });
    }).then(function () {
        console.log('Cleaning up');
        platform.exit();
    }).done();
}

main();
