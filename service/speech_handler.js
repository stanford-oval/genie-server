// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const stream = require('stream');
const events = require('events');
const path = require('path');

const snowboy = require('snowboy');

const SpeechRecognizer = require('./speech_recognizer');

class DetectorStream extends stream.Transform {
    constructor() {
        super();

        let models = new snowboy.Models();
        for (let m of ['snowboy.umdl', 'almond.pmdl']) {
	     models.add({
                 file: path.resolve(module.filename, '../../data/' + m),
                 sensitivity: '0.5',
                 hotwords : 'snowboy'
             });
        }

        this._detector = new snowboy.Detector({
            resource: path.resolve(module.filename, '../../data/snowboy.res'),
            models: models
        });
        this._queuedForDetection = [];
        this._detectionMinSize = 0.2 * 16000 * 1 * 2; // 2 bytes per sample, 16kHz, 1 channel, 0.2 seconds
        this._queuedForDetectionSize = 0;

        this._accumulator = [];
        this._detector.on('silence', () => {
            //console.log('Silence detected');
            this._accumulator.length = 0;
        });
        this._detected = false;
        this._detector.on('hotword', (index, hotword, buffer) => {
            this._detected = true;
            let acc = this._accumulator;
            this._accumulator = [];
            for (let buf of acc)
                this.push(buf);
            this.emit('hotword', hotword);
        });
    }

    finishRequest() {
        console.log('Request finished');
        this._detected = false;
    }

    _transform(chunk, encoding, callback) {
        if (this._detected) {
            this.push(chunk);
        } else {
            this._accumulator.push(chunk);

            this._queuedForDetection.push(chunk);
            this._queuedForDetectionSize += chunk.length;
            if (this._queuedForDetectionSize > 0) {
                let toDetect = Buffer.concat(this._queuedForDetection, this._queuedForDetectionSize);
                this._queuedForDetection.length = 0;
                this._queuedForDetectionSize = 0;
                this._detector.runDetection(toDetect);
            }
        }
        callback();
    }
}

module.exports = class SpeechHandler extends events.EventEmitter {
    constructor(platform) {
        super();
        this._platform = platform;
        this._pulse = platform.getCapability('pulseaudio');

        this._recognizer = new SpeechRecognizer({ locale: this._platform.locale });
        this._recognizer.on('error', (e) => this.emit('error', e));
    }

    start() {
        this._stream = this._pulse.createRecordStream({ format: 'S16LE', rate: 16000, channels: 1 });

        this._stream.on('state', (state) => {
            console.log('Record stream is now ' + state);
            if (state === 'ready')
                this.emit('ready');
        });
        this._stream.on('error', (e) => this.emit('error', e));

        this._detector = new DetectorStream();
        this._detector.on('hotword', (hotword) => {
            console.log('Hotword ' + hotword + ' detected');
            let req = this._recognizer.request(this._detector);
            req.on('hypothesis', (hypothesis) => this.emit('hypothesis', hypothesis));
            req.on('done', (status, utterance) => {
                if (status === 'Success') {
                    console.log('Recognized as "' + utterance + '"');
                    this.emit('utterance', utterance);
                } else {
                    console.log('Recognition error: ' + status);
                }
                this._detector.finishRequest();
            });
        });
        this._stream.pipe(this._detector);
    }

    stop() {
        if (!this._stream)
            return;
        this._stream.end();
        this._stream = null;
        this._recognizer.close();
    }
}
