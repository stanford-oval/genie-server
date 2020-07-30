// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const stream = require('stream');
const path = require('path');
const snowboy = require('snowboy');

module.exports = class SnowboyDetectorStream extends stream.Writable {
    constructor() {
        super();

        let models = new snowboy.Models();
        models.add({
             file: path.resolve(path.dirname(module.filename), '../../data/wake-word/snowboy/computer.umdl'),
             sensitivity: '0.6',
             hotwords : 'computer'
        });

        this._detector = new snowboy.Detector({
            resource: path.resolve(path.dirname(module.filename), '../../data/wake-word/snowboy/common.res'),
            models: models,
            audioGain: 1.0,
            applyFrontend: true,
        });

        this._detector.on('silence', () => {
            this.emit('silence');
        });
        this._detector.on('sound', () => {
            this.emit('sound');
        });
        this._detector.on('hotword', (index, hotword, buffer) => {
            this.emit('wakeword', hotword);
        });
    }

    _write(chunk, encoding, callback) {
        this._detector.write(chunk, encoding, callback);
    }
};
