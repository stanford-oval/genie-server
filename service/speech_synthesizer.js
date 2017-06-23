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
        this._queue = [];
        this._promise = Q();
    }

    clearQueue() {
        this._queue.length = 0;
    }

    say(text) {
        this._queue.push(text);
        return this._promise = this._promise.then(() => this._sayNext());
    }

    _sayNext() {
        if (this._queue.length === 0)
            return Q();
        let text = this._queue.shift();
        return Q.nfcall(child_process.execFile, '../mimic/mimic', ['-voice', 'slt', '-t', text]);
    }
}
