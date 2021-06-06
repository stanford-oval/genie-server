// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019-2020 The Board of Trustees of the Leland Stanford Junior University
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


// Server platform

const Q = require('q');
const fs = require('fs');
const os = require('os');
const events = require('events');
const Tp = require('thingpedia');
const child_process = require('child_process');
const Gettext = require('node-gettext');
const path = require('path');
let PulseAudio;
try {
    PulseAudio = require('pulseaudio2');
} catch(e) {
    PulseAudio = null;
}
let canberra;
try {
    canberra = require('canberra');
} catch(e) {
    canberra = null;
}

const _graphicsApi = require('./graphics');

let WakeWordDetector;
try {
    WakeWordDetector = require('../wake-word/snowboy');
} catch(e) {
    WakeWordDetector = null;
}

// FIXME
const Builtins = require('genie-toolkit/dist/lib/engine/devices/builtins');

const Config = require('../../config');

let _unzipApi = {
    unzip(zipPath, dir) {
        let args = ['-uo', zipPath, '-d', dir];
        return Q.nfcall(child_process.execFile, '/usr/bin/unzip', args, {
            maxBuffer: 10 * 1024 * 1024 }).then((zipResult) => {
            let stdout = zipResult[0];
            let stderr = zipResult[1];
            console.log('stdout', stdout);
            console.log('stderr', stderr);
        });
    }
};

/*
const JavaAPI = require('./java_api');
const StreamAPI = require('./streams');

const _unzipApi = JavaAPI.makeJavaAPI('Unzip', ['unzip'], [], []);
const _gpsApi = JavaAPI.makeJavaAPI('Gps', ['start', 'stop'], [], ['onlocationchanged']);
const _notifyApi = JavaAPI.makeJavaAPI('Notify', [], ['showMessage'], []);
const _audioManagerApi = JavaAPI.makeJavaAPI('AudioManager', [],
    ['setRingerMode', 'adjustMediaVolume', 'setMediaVolume'], []);
const _smsApi = JavaAPI.makeJavaAPI('Sms', ['start', 'stop', 'sendMessage'], [], ['onsmsreceived']);
const _audioRouterApi = JavaAPI.makeJavaAPI('AudioRouter',
    ['setAudioRouteBluetooth'], ['start', 'stop', 'isAudioRouteBluetooth'], []);
const _systemAppsApi = JavaAPI.makeJavaAPI('SystemApps', [], ['startMusic'], []);
const _contentJavaApi = JavaAPI.makeJavaAPI('Content', [], ['getStream'], []);
const _contentApi = {
    getStream(url) {
        return _contentJavaApi.getStream(url).then(function(token) {
            return StreamAPI.get().createStream(token);
        });
    }
}
const _telephoneApi = JavaAPI.makeJavaAPI('Telephone', ['call', 'callEmergency'], [], []);
*/

const _contentApi = {
    getStream(url) {
        return new Promise((resolve, reject) => {
            if (url.startsWith('file:///')) {
                const path = url.substring('file://'.length);
                child_process.execFile('xdg-mime', ['query', 'filetype', path], (err, stdout, stderr) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    let stream = fs.createReadStream(path);
                    stream.contentType = String(stdout).trim();
                    resolve(stream);
                });
            } else {
                reject(new Error('Unsupported url ' + url));
            }
        });
    }
};

function safeMkdirSync(dir) {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if (e.code !== 'EEXIST')
            throw e;
    }
}

function getUserConfigDir() {
    if (process.platform === 'win32')
        return process.env.APPDATA;
    if (process.env.XDG_CONFIG_HOME)
        return process.env.XDG_CONFIG_HOME;
    return os.homedir() + '/.config';
}
function getUserCacheDir() {
    if (process.platform === 'win32')
        return process.env.TEMP;
    if (process.env.XDG_CACHE_HOME)
        return process.env.XDG_CACHE_HOME;
    return os.homedir() + '/.cache';
}
function getFilesDir() {
    if (process.env.THINGENGINE_HOME)
        return process.env.THINGENGINE_HOME;
    else
        return getUserConfigDir() + '/almond-server';
}
function getCacheDir() {
    if (process.env.THINGENGINE_HOME)
        return process.env.THINGENGINE_HOME + '/cache';
    else
        return getUserCacheDir() + '/almond-server';
}

const _gpsApi = {
    start() {},
    stop() {},

    _location: null,
    onlocationchanged: null,

    setLocation(v) {
        this._location = v;
        if (this.onlocationchanged)
            this.onlocationchanged(null, v);
    },

    async getCurrentLocation() {
        return this._location;
    }
};

// A simple Audio Player based on GStreamer
class Player extends events.EventEmitter {
    constructor(child) {
        super();
        this._child = child;

        child.on('exit', () => {
            this.emit('done');
        });
        child.on('error', (e) => {
            this.emit('error', e);
        });
    }

    async stop() {
        if (this._child)
            this._child.kill();
    }
}

const _audioPlayerApi = {
    play(urls) {
        return new Player(child_process.spawn('gst-play-1.0', [ "-q" ].concat(urls), {
            stdio: ['ignore', process.stdout, process.stderr]
        }));
    }
};

const LOCAL_SOUND_EFFECTS = ['news-intro'];
const KNOWN_SOUND_EFFECTS = ['alarm-clock-elapsed', 'audio-channel-front-center', 'audio-channel-front-left', 'audio-channel-front-right', 'audio-channel-rear-center', 'audio-channel-rear-left', 'audio-channel-rear-right', 'audio-channel-side-left', 'audio-channel-side-right', 'audio-test-signal', 'audio-volume-change', 'bell', 'camera-shutter', 'complete', 'device-added', 'device-removed', 'dialog-error', 'dialog-information', 'dialog-warning', 'message-new-instant', 'message', 'network-connectivity-established', 'network-connectivity-lost', 'phone-incoming-call', 'phone-outgoing-busy', 'phone-outgoing-calling', 'power-plug', 'power-unplug', 'screen-capture', 'service-login', 'service-logout', 'suspend-error', 'trash-empty', 'window-attention', 'window-question'];

const SOUND_EFFECT_ID = 0;
class SoundEffectsApi {
    constructor() {
        this._ctx = new canberra.Context({
            [canberra.Property.APPLICATION_ID]: 'edu.stanford.Almond',
        });

        try {
            this._ctx.cache({
                'media.role': 'voice-assistant',
                [canberra.Property.EVENT_ID]: 'message-new-instant'
            });

            this._ctx.cache({
                'media.role': 'voice-assistant',
                [canberra.Property.EVENT_ID]: 'dialog-warning'
            });
        } catch(e) {
            console.error(`Failed to cache event sound: ${e.message}`);
        }
    }

    getURL(name) {
        if (LOCAL_SOUND_EFFECTS.includes(name))
            return 'file://' + path.resolve(path.dirname(module.filename), '../../../data/sound-effects/' + name + '.oga');
        else if (KNOWN_SOUND_EFFECTS.includes(name))
            return 'file:///usr/share/sounds/freedesktop/stereo/' + name + '.oga';
        else
            return undefined;
    }

    play(name, id = SOUND_EFFECT_ID) {
        const options = {
            'media.role': 'voice-assistant',
        };
        if (LOCAL_SOUND_EFFECTS.includes(name))
            options['media.filename'] = path.resolve(path.dirname(module.filename), '../../../data/sound-effects/' + name + '.oga');
        else
            options['event.id'] = name;

        return this._ctx.play(id, options);
    }
}

module.exports = class ServerPlatform extends Tp.BasePlatform {
    constructor() {
        super();

        this._gettext = new Gettext();

        this._filesDir = getFilesDir();
        safeMkdirSync(this._filesDir);

        this._setLocale();
        this._timezone = process.env.TZ;
        this._prefs = new Tp.Helpers.FilePreferences(this._filesDir + '/prefs.db');
        this._cacheDir = getCacheDir();
        safeMkdirSync(this._cacheDir);

        this._wakeWordDetector = null;
        this._soundEffects = null;

        this._sqliteKey = null;
        this._origin = null;

        this._serverDev = {
            kind: 'org.thingpedia.builtin.thingengine.server',
            class: fs.readFileSync(path.resolve(__dirname, '../../../data/thingengine.server.tt')).toString(),
            module: require('./thingengine.server')
        };

        // HACK: thingengine-core will try to load thingengine-own-desktop from the db
        // before PairedEngineManager calls getPlatformDevice(), which can result in loading
        // the device as unsupported (and that would be bad)
        // to avoid that, we inject it eagerly here
        Builtins.default[this._serverDev.kind] = this._serverDev;
    }

    async _ensurePulseConfig() {
        try {
            let hasFilterHeuristics = false, hasFilterApply = false;
            const pulseModList = await this._pulse.modules();
            for (let i = 0; i < pulseModList.length; i++) {
                const mod = pulseModList[i];
                if (mod.name === 'module-filter-heuristics')
                    hasFilterHeuristics = true;
                if (mod.name === 'module-filter-apply')
                    hasFilterApply = true;
                if (mod.name === 'module-role-ducking')
                    await this._pulse.unloadModule(mod.index);
            }
            if (!hasFilterHeuristics)
                await this._pulse.loadModule("module-filter-heuristics");
            if (!hasFilterApply)
                await this._pulse.loadModule("module-filter-apply");
            await this._pulse.loadModule("module-role-ducking", "trigger_roles=voice-assistant ducking_roles=music volume=40% global=true");
        } catch(e) {
            console.error("failed to configure PulseAudio");
        }
    }

    _ensurePulseAudio() {
        if (this._pulse !== undefined)
            return;

        if (PulseAudio) {
            this._pulse = new PulseAudio();
            this._pulse.on('error', (err) => { console.error('error on PulseAudio', err); });
            this._pulse.on('connection', () => {
                this._ensurePulseConfig();
            });

            if (WakeWordDetector)
                this._wakeWordDetector = new WakeWordDetector();

            if (canberra)
                this._soundEffects = new SoundEffectsApi();
        } else {
            this._pulse = null;
        }
    }

    get type() {
        return 'server';
    }

    get encoding() {
        return 'utf8';
    }

    get locale() {
        return this._locale;
    }

    get timezone() {
        return this._timezone;
    }

    // Check if we need to load and run the given thingengine-module on
    // this platform
    // (eg we don't need discovery on the cloud, and we don't need graphdb,
    // messaging or the apps on the phone client)
    hasFeature(feature) {
        return true;
    }

    getPlatformDevice() {
        return this._serverDev;
    }

    // Check if this platform has the required capability
    // (eg. long running, big storage, reliable connectivity, server
    // connectivity, stable IP, local device discovery, bluetooth, etc.)
    //
    // Which capabilities are available affects which apps are allowed to run
    hasCapability(cap) {
        switch (cap) {
        case 'code-download':
        case 'gps':
        case 'graphics-api':
        case 'content-api':
        case 'audio-player':
        case 'gettext':
            return true;

        case 'pulseaudio':
        case 'sound':
            this._ensurePulseAudio();
            return this._pulse !== null;

        case 'wakeword-detector':
            this._ensurePulseAudio();
            return this._wakeWordDetector !== null;

        case 'sound-effects':
            this._ensurePulseAudio();
            return this._soundEffects !== null;

        default:
            return false;
        }
    }

    // Retrieve an interface to an optional functionality provided by the
    // platform
    //
    // This will return null if hasCapability(cap) is false
    getCapability(cap) {
        switch (cap) {
        case 'code-download':
            // We have the support to download code
            return _unzipApi;

        case 'sound':
        case 'pulseaudio': // legacy name for "sound"
            this._ensurePulseAudio();
            return this._pulse;
        case 'wakeword-detector':
            this._ensurePulseAudio();
            return this._wakeWordDetector;
        case 'sound-effects':
            this._ensurePulseAudio();
            return this._soundEffects;
        case 'audio-player':
            return _audioPlayerApi;
        case 'content-api':
            return _contentApi;
        case 'graphics-api':
            return _graphicsApi;
        case 'gps':
            return _gpsApi;

        case 'gettext':
            return this._gettext;

        default:
            return null;
        }
    }

    // Obtain a shared preference store
    // Preferences are simple key/value store which is shared across all apps
    // but private to this instance (tier) of the platform
    // Preferences should be normally used only by the engine code, and a persistent
    // shared store such as DataVault should be used by regular apps
    getSharedPreferences() {
        return this._prefs;
    }

    // Get a directory that is guaranteed to be writable
    // (in the private data space for Android)
    getWritableDir() {
        return this._filesDir;
    }

    // Get a temporary directory
    // Also guaranteed to be writable, but not guaranteed
    // to persist across reboots or for long times
    // (ie, it could be periodically cleaned by the system)
    getTmpDir() {
        return os.tmpdir();
    }

    // Get a directory good for long term caching of code
    // and metadata
    getCacheDir() {
        return this._cacheDir;
    }

    // Get the filename of the sqlite database
    getSqliteDB() {
        return this._filesDir + '/sqlite.db';
    }

    _setLocale() {
        let locale = 'en-US';
        if (process.env.LOCALE)
            locale = process.env.LOCALE;
        this._locale = locale;
        // normalize this._locale to something that Intl can grok
        this._locale = this._locale.split(/[-_.@]/).slice(0, 2).join('-');
        this._gettext.setLocale(this._locale);
    }

    _setSqliteKey(key) {
        this._sqliteKey = key.toString('hex');
    }

    getSqliteKey() {
        return this._sqliteKey;
    }

    // Stop the main loop and exit
    // (In Android, this only stops the node.js thread)
    // This function should be called by the platform integration
    // code, after stopping the engine
    exit() {
        process.exit();
    }

    // Get the ThingPedia developer key, if one is configured
    getDeveloperKey() {
        return this._prefs.get('developer-key');
    }

    // Change the ThingPedia developer key, if possible
    // Returns true if the change actually happened
    setDeveloperKey(key) {
        return this._prefs.set('developer-key', key);
    }

    _setOrigin(origin) {
        this._origin = origin;
    }

    getOAuthRedirect() {
        return Config.CLOUD_SYNC_URL;
    }

    getOrigin() {
        if (process.env.THINGENGINE_ORIGIN)
            return process.env.THINGENGINE_ORIGIN;
        return this._origin;
    }

    getCloudId() {
        return this._prefs.get('cloud-id');
    }

    getAuthToken() {
        return this._prefs.get('auth-token');
    }

    // Change the auth token
    // Returns true if a change actually occurred, false if the change
    // was rejected
    setAuthToken(authToken) {
        let oldAuthToken = this._prefs.get('auth-token');
        if (oldAuthToken !== undefined && authToken !== oldAuthToken)
            return false;
        this._prefs.set('auth-token', authToken);
        return true;
    }
};
