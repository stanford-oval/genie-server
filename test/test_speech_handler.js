// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const SpeechHandler = require('../service/speech_handler');
const platform = require('../service/platform');

function main() {
    platform.init();
    let handler = new SpeechHandler(platform);

    handler.on('ready', () => {
        console.log('Speak now...');
    });
    handler.on('hypothesis', (hypothesis) => {
        console.log('Hypothesis: ' + hypothesis);
    });
    handler.on('utterance', (utterance) => {
        console.log('Utterance: ' + utterance);
    });
    handler.on('error', (e) => {
        console.error('Error', e);
    });
    handler.start();
}
main();
