// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Tp = require('thingpedia');
const assert = require('assert');

class CancelledError extends Error {
    constructor() {
        super("Cancelled");
        this.code = 'ECANCELLED';
    }
}

const Config = require('../../config');

module.exports = class SpeechSynthesizer {
    constructor(platform) {
        this._locale = platform.locale;
        this._pulseCtx = platform.getCapability('pulseaudio');

        this._queue = [];
        this._speaking = false;

        this._outputStream = null;
        this._closeTimeout = null;
    }

    start() {
    }
    stop() {
    }

    clearQueue() {
        if (this._outputStream)
            this._outputStream.discard();

        const err = new CancelledError();
        for (const q of this._queue) {
            if (typeof q.reject === 'function')
                q.reject(err);
        }
        this._queue.length = 0;
    }

    async _synth(text) {
        const [buffer,] = await Tp.Helpers.Http.post(Config.SEMPRE_URL + '/' + this._locale + '/voice/tts', JSON.stringify({
            text
        }), {
            dataContentType: 'application/json',
            raw: true
        });

        const numChannels = buffer.readInt16LE(22);
        const sampleRate = buffer.readInt32LE(24);
        // check bytes per sample (we only support S16LE format, which is what everybody uses anyway)
        assert.strictEqual(buffer.readInt16LE(32), 2);

        console.log(this._numChannels, this._sampleRate);

        // remove the wav header (44 bytes)
        const sliced = buffer.slice(44, buffer.length);
        console.log(buffer.length, sliced.length);

        return { buffer: sliced, sampleRate, numChannels, text };
    }

    say(text) {
        if (this._currentFrame !== this._nextFrame) {
            this.clearQueue();
            this._currentFrame = this._nextFrame;
        }

        this._queue.push(this._synth(text));
        if (!this._speaking)
            this._sayNext();
    }
    endFrame() {
        const callbacks = {};
        const promise = new Promise((resolve, reject) => {
            callbacks.resolve = resolve;
            callbacks.reject = reject;
        });

        this._queue.push(callbacks);
        if (!this._speaking)
            this._sayNext();

        return promise;
    }

    _silence() {
        // force flush the buffer with 0.15 second of silence
        // this also causes a pause between the utterances, which sounds natural
        // and slows down the pace
        let bufferLength = 0.15 * this._sampleRate * this._numChannels * 2;
        this._outputStream.write(Buffer.alloc(bufferLength));
        return 1000;
    }

    _ensureOutputStream(result) {
        if (this._closeTimeout)
            clearTimeout(this._closeTimeout);
        this._closeTimeout = setTimeout(() => {
            this._outputStream.end();
            this._outputStream = null;
            this._closeTimeout = null;
        }, 60000);

        if (this._outputStream && this._sampleRate === result.sampleRate
            && this._numChannels === result.numChannels)
            return;
        if (this._outputStream)
            this._outputStream.end();
        this._sampleRate = result.sampleRate;
        this._numChannels = result.numChannels;
        this._outputStream = this._pulseCtx.createPlaybackStream({
            format: 'S16LE', // signed 16 bit little endian
            rate: this._sampleRate,
            channels: this._numChannels,
            stream: 'thingengine-voice-output',
            latency: 100000, // us (= 0.1 s)
            properties: {
                'filter.want': 'echo-cancel',
            }
        });
    }

    async _sayNext() {
        if (this._queue.length === 0) {
            this._speaking = false;
            return;
        }
        this._speaking = true;

        const qitem = this._queue.shift();
        try {
            if (typeof qitem.resolve === 'function') {
                qitem.resolve();
            } else {
                const result = await qitem;
                this._ensureOutputStream(result);

                let duration = result.buffer.length /2 /
                    result.sampleRate / result.numChannels * 1000;
                console.log('outputstream write for ' + result.text + ', delay of ' + duration);
                this._outputStream.write(result.buffer);
                duration += this._silence();
            }
        } catch (e) {
            console.error('Failed to speak: ' + e);
        }

        process.nextTick(() => this._sayNext());
    }
};
