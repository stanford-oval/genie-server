// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2020 The Board of Trustees of the Leland Stanford Junior University
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
"use strict";

const stream = require('stream');
const path = require('path');
const snowboy = require('snowboy');

// keep 1.5 seconds of audio
// (at 16kHz mono, 2 bytes per sample)
const AUDIO_BUFFER = 1.5 * 16000 * 2;

module.exports = class SnowboyDetectorStream extends stream.Writable {
    constructor() {
        super();

        let models = new snowboy.Models();
        models.add({
             file: path.resolve(path.dirname(module.filename), '../../../data/wake-word/snowboy/computer.umdl'),
             sensitivity: 0.4,
             hotwords : 'computer'
        });

        this._detector = new snowboy.Detector({
            resource: path.resolve(path.dirname(module.filename), '../../../data/wake-word/snowboy/common.res'),
            models: models,
            audioGain: 1.0,
            applyFrontend: true,
        });

        console.log('Snowboy initialized');

        this._buffers = [];
        this._bufferLength = 0;

        this._detector.on('silence', () => {
            this.emit('silence');
        });
        this._detector.on('sound', () => {
            this.emit('sound');
        });
        this._detector.on('hotword', (index, hotword) => {
            const buffer = Buffer.concat(this._buffers, this._bufferLength);
            this._buffers = [];
            this._bufferLength = 0;
            this.emit('wakeword', hotword, buffer);
        });
    }

    _write(chunk, encoding, callback) {
        // add the current chunk to the buffer
        this._buffers.push(chunk);
        this._bufferLength += chunk.length;
        if (this._bufferLength > AUDIO_BUFFER) {
            let toRemove = this._bufferLength - AUDIO_BUFFER;
            while (toRemove > this._buffers[0].length)
                toRemove -= this._buffers.shift().length;
            if (toRemove > 0)
                this._buffers[0] = this._buffers[0].slice(toRemove);
            this._bufferLength = AUDIO_BUFFER;
        }


        this._detector.write(chunk, encoding, callback);
    }
};
