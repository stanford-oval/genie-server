// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
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

const util = require('util');
const child_process = require('child_process');

// A simple Media Player based on GStreamer
module.exports = class MediaPlayer {
    constructor() {
        this._playing = null;
    }

    async _discover(url) {
        if (url.startsWith('https://www.youtube.com/watch?v=') ||
            url.startsWith('http://www.youtube.com/watch?v='))
            return 'youtube';

        const { stdout, } = await util.promisify(child_process.execFile)('gst-discoverer-1.0', [url]);
        if (stdout.indexOf('video') >= 0)
            return 'video';
        else if (stdout.indexOf('audio') >= 0)
            return 'audio';
        else
            return 'unknown';
    }

    stopPlaying() {
        if (this._playing)
            this._playing.kill();
        else
            console.log('Not playing, nothing to do');
    }

    _startAudio(url) {
        if (this._playing)
            this._playing.kill();
        let playing = child_process.spawn('gst-play-1.0', [url], {
            stdio: ['ignore', process.stdout, process.stderr]
        });
        playing.on('exit', () => {
            if (this._playing === playing)
                this._playing = null;
        });
        this._playing = playing;
    }

    _startVideo(url) {
        if (this._playing)
            this._playing.kill();
        let playing = child_process.spawn('gst-play-1.0', [url], {
            stdio: ['ignore', process.stdout, process.stderr]
        });
        playing.on('exit', () => {
            if (this._playing === playing)
                this._playing = null;
        });
        this._playing = playing;
    }

    _startBrowser(url) {
        child_process.spawn('xdg-open', [url], { stdio: 'inherit' });
    }

    startPlaying(url) {
        return this._discover(url).then((discovered) => {
            if (discovered === 'unknown')
                throw new Error(url + " does not look like a media file");
            else if (discovered === 'audio')
                this._startAudio(url);
            else if (discovered === 'video')
                this._startVideo(url);
            else if (discovered === 'youtube')
                this._startBrowser(url);
        });
    }
};
