// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const stream = require('stream');
const events = require('events');
const path = require('path');

const snowboy = require('snowboy');

const SpeechRecognizer = require('./speech_recognizer');
const SpeakerIdentifier = require('./speaker_id');

class DetectorStream extends stream.Transform {
    constructor() {
        super();

        let models = new snowboy.Models();
        /*for (let p of ['silei', 'gcampagn']) {*/
             models.add({
                 file: path.resolve(module.filename, '../../data/gcampagn.pmdl'),
                 sensitivity: '0.4',
                 hotwords : 'almond'
             });
        /*}*/

        this._detector = new snowboy.Detector({
            resource: path.resolve(module.filename, '../../data/snowboy.res'),
            models: models,
            audio_gain: 2
        });

        this._detector.on('silence', () => {
        });
        this._detected = false;
        this._detector.on('sound', () => {
            if (this.autoTrigger)
                this._detected = true;
            this.emit('sound');
        });
        this._detector.on('hotword', (index, hotword, buffer) => {
            this._detected = true;
            this.emit('hotword', hotword);
        });

        this.autoTrigger = false;
    }

    finishRequest() {
        console.log('Request finished');
        this._detected = false;
        this.autoTrigger = false;
    }

    _transform(chunk, encoding, callback) {
        if (!this._detected)
            this._detector.runDetection(chunk);
        if (this._detected)
            this.push(chunk);
        callback();
    }
}


module.exports = class SpeechHandler extends events.EventEmitter {
    constructor(platform) {
        super();
        this._platform = platform;
        this._pulse = platform.getCapability('pulseaudio');

        this._speakerId = new SpeakerIdentifier(this._platform.getCapability('contacts'));
        this._recognizer = new SpeechRecognizer({ locale: this._platform.locale });
        this._recognizer.on('error', (e) => {
            this._detector.finishRequest();
            this.emit('error', e);
        });

        this._autoTrigger = false;
    }

    setAutoTrigger(autoTrigger) {
        console.log('setAutoTrigger', autoTrigger);
        this._autoTrigger = autoTrigger;
        this._detector.autoTrigger = autoTrigger;
    }

    _onDetected() {
        const speakerIdReq = this._speakerId.request(this._detector);
        const recognizerReq = this._recognizer.request(this._detector);
        speakerIdReq.on('error', (e) => this.emit('error', e));
        recognizerReq.on('hypothesis', (hypothesis) => this.emit('hypothesis', hypothesis));
        recognizerReq.on('done', (status, utterance) => {
            if (status === 'Success') {
                console.log('Recognized as "' + utterance + '"');

                Promise.resolve(speakerIdReq.complete()).then((speaker) => {
                    this.emit('utterance', utterance, speaker);
                }).catch((e) => {
                    this.emit('error', e);
                });
            } else if (status === 'NoMatch') {
                this.emit('no-match');
            } else if (status === 'InitialSilenceTimeout') {
                this.emit('silence');
            } else {
                console.log('Recognition error: ' + status);
            }
            this._detector.finishRequest();
        });
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
        this._detector.on('sound', () => {
            if (this._detector.autoTrigger)
                this._onDetected();
        });
        this._detector.on('hotword', (hotword) => {
            console.log('Hotword ' + hotword + ' detected');
            this.emit('hotword', hotword);
            this._onDetected();
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
};
