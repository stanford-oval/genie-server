// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2018 Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Tp = require('thingpedia');
const https = require('https');
const Url = require('url');
const Stream = require('stream');
const events = require('events');

const WavUtils = require('../util/wav');

const Config = require('../config');

const URL = 'https://westus.api.cognitive.microsoft.com/spid/v1.0/identify?shortAudio=true&identificationProfileIds=';

function delay(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

const CONFIDENCE_LEVELS = {
    'Low': -1,
    'Normal': 0,
    'High': 1,
};

class SpeakerIdRequest extends events.EventEmitter {
    constructor(userRegistry, stream) {
        super();

        this._userRegistry = userRegistry;
        this._stream = stream;
        this._dataListener = this._onStreamData.bind(this);
        this._endListener = this._onStreamEnd.bind(this);

        this._uploadStream = new Stream.Readable({ read() {} });

        // As common practice, we lie about the size of the WAV file
        // but we only lie a little: just enough to go through
        // the validator, which checks the maximum 5 minutes length
        this._uploadStream.push(WavUtils.getRIFFHeader(5 * 60));

        stream.on('data', this._dataListener);
        stream.on('end', this._endListener);

        this._startPromise = this._start();
    }

    async _start() {
        const userSpeakerIds = this._userRegistry.getAllSpeakerIds();

        // the start request is weird because it returns a 202 + a
        // Location header that we need to get to
        const httpres = await new Promise((resolve, reject) => {
            const parsed = Url.parse(URL + userSpeakerIds.join(','));
            parsed.headers = {
                'Content-Type': 'application/octet-stream',
                'Ocp-Apim-Subscription-Key': Config.MS_SPEAKER_IDENTIFICATION_KEY
            };
            parsed.method = 'POST';
            const req = https.request(parsed, resolve);
            req.on('error', reject);
            this._uploadStream.pipe(req);
        });
        httpres.resume();
        if (httpres.statusCode !== 202) {
            httpres.on('data', (line) => {
                console.log(String(line));
            });
            throw new Error('Invalid HTTP status from MS Speaker Id: ' + httpres.statusCode);
        }

        return httpres.headers['operation-location'];
    }

    _onStreamData(data) {
        this._uploadStream.push(data);
    }
    _onStreamEnd() {
        this._stream.removeListener('data', this._dataListener);
        this._stream.removeListener('end', this._endListener);
        this._uploadStream.push(null);
    }

    async _tryGetOperationResult(opId) {
        const response = JSON.parse(await Tp.Helpers.Http.get(opId, {
            extraHeaders: {
                'Ocp-Apim-Subscription-Key': Config.MS_SPEAKER_IDENTIFICATION_KEY
            }
        }));
        console.log(response);

        if (response.status === 'notstarted' || response.status === 'running')
            return [false, null];
        if (response.status === 'failed')
            throw new Error(response.message);

        const profileId = response.processingResult.identifiedProfileId;
        return [true, {
            id: profileId === '00000000-0000-0000-0000-000000000000' ? null : profileId,
            confidence: CONFIDENCE_LEVELS[response.processingResult.confidence]
        }];
    }

    async complete() {
        this._onStreamEnd();

        const opId = await this._startPromise;

        for (let attempts = 20; attempts > 0; attempts--) {
            let [ok, speakerId] = await this._tryGetOperationResult(opId);
            if (ok)
                return speakerId;

            await delay(1000);
        }

        throw new Error('Operation failed after 10 attempts to retrieve the result');
    }
}

module.exports = class SpeakerIdentifier {
    constructor(locale) {
        this._locale = locale;
    }

    request(stream) {
        return new SpeakerIdRequest(stream);
    }
};