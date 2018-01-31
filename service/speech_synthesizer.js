// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const mimic = require('node-mimic');

module.exports = class SpeechSynthesizer {
    constructor(pulseCtx, voiceFile) {
        this._pulseCtx = pulseCtx;
        this._voiceFile = voiceFile;
        this._queue = [];
        this._promise = Q();

        this._outputStream = null;
        this._closeTimeout = null;
        mimic.init();
    }

    start() {
        return this._promise = Q.nfcall(mimic.loadVoice, this._voiceFile).then((voice) => {
            this._voice = voice;
        });
    }
    stop() {
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
        return Q.ninvoke(this._voice, 'textToSpeech', text).then((result) => {
            if (!this._outputStream) {
                this._outputStream = this._pulseCtx.createPlaybackStream({
                    format: 'S16NE',
                    rate: result.sampleRate,
                    channels: result.numChannels,
                    stream: 'thingengine-voice-output'
                });
            }
            if (this._closeTimeout)
                clearTimeout(this._closeTimeout);
            this._closeTimeout = setTimeout(() => {
                this._outputStream.end();
                this._outputStream = null;
                this._closeTimeout = null;
            }, 60000);

            let duration = result.buffer.length /2 /
                result.sampleRate / result.numChannels * 1000;
            console.log('outputstream write for ' + text);
            this._outputStream.write(result.buffer);
            return Q.delay(duration);
        }).catch((e) => {
            console.error('Failed to speak: ' + e);
        });
    }
}
