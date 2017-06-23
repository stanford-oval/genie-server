// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const child_process = require('child_process');

module.exports = class SpeechSynthesizer {
    constructor() {
        this._queue = Q();
    }

    say(text) {
        return this._queue = this._queue.then(() => Q.nfcall(child_process.execFile, '../mimic/mimic', ['-voice', 'slt', '-t', text]));
    }
}
