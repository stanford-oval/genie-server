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
const AsyncQueue = require('consumer-queue');

module.exports = class SpeechSynthesizer {
    constructor(pulseCtx, voiceFile) {
        this._pulseCtx = pulseCtx;
        this._voiceFile = voiceFile;
        this._queue = new AsyncQueue();
        this._load = Q();

        this._outputStream = null;
        this._closeTimeout = null;
        mimic.init();
    }

    start() {
        this._load = Q.nfcall(mimic.loadVoice, this._voiceFile).then((voice) => {
            this._voice = voice;
        });

        // start the speech "thread" asynchronously
        this._sayNext();
        return this._load;
    }
    stop() {
    }

    clearQueue() {
        this._queue.length = 0;
    }

    say(text) {
        this._queue.push(text);
    }
    whenDone(callback) {
        this._queue.push(callback);
    }

    _silence() {
        if (!this._outputStream)
            return 0;

        // force flush the buffer with 1 second of silence
        let bufferLength = 1 * this._sampleRate * this._numChannels * 2;
        this._outputStream.write(Buffer.alloc(bufferLength));
        return 1000;
    }

    _sayNext() {
        this._load.then(() => {
            return this._queue.pop();
        }).then((text) => {
            if (typeof text === 'function')
                return text();

            return Q.ninvoke(this._voice, 'textToSpeech', text).then((result) => {
                if (!this._outputStream) {
                    this._outputStream = this._pulseCtx.createPlaybackStream({
                        format: 'S16NE', // signed 16 bit native endian
                        rate: result.sampleRate,
                        channels: result.numChannels,
                        stream: 'thingengine-voice-output',
                        latency: 100000, // us (= 0.1 s)
                    });
                    this._sampleRate = result.sampleRate;
                    this._numChannels = result.numChannels;
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
                console.log('outputstream write for ' + text + ', delay of ' + duration);
                this._outputStream.write(result.buffer);
                duration += this._silence();
                return Q.delay(duration);
            });
        }).catch((e) => {
            console.error('Failed to speak: ' + e);
        }).then(() => this._sayNext());
    }
};
