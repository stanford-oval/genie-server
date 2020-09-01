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
"use strict";

// Server platform

const Q = require('q');
const fs = require('fs');
const os = require('os');
const Tp = require('thingpedia');
const child_process = require('child_process');
const Gettext = require('node-gettext');
const DBus = require('dbus-native');
let PulseAudio;
try {
    PulseAudio = require('pulseaudio2');
} catch(e) {
    PulseAudio = null;
}

const BluezBluetooth = require('./bluez');
const MediaPlayer = require('./media_player');
const _graphicsApi = require('./graphics');

let WakeWordDetector;
try {
    WakeWordDetector = require('../wake-word/snowboy');
} catch(e) {
    WakeWordDetector = null;
}

const Config = require('../../config');

var _unzipApi = {
    unzip(zipPath, dir) {
        var args = ['-uo', zipPath, '-d', dir];
        return Q.nfcall(child_process.execFile, '/usr/bin/unzip', args, {
            maxBuffer: 10 * 1024 * 1024 }).then((zipResult) => {
            var stdout = zipResult[0];
            var stderr = zipResult[1];
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
const _btApi = JavaAPI.makeJavaAPI('Bluetooth',
    ['start', 'startDiscovery', 'pairDevice', 'readUUIDs'],
    ['stop', 'stopDiscovery'],
    ['ondeviceadded', 'ondevicechanged', 'onstatechanged', 'ondiscoveryfinished']);
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

class ServerPlatform extends Tp.BasePlatform {
    constructor() {
        super();

        this._gettext = new Gettext();

        this._filesDir = getFilesDir();
        safeMkdirSync(this._filesDir);
        // TODO support other locales
        this._locale = 'en-US';
        // normalize this._locale to something that Intl can grok
        this._locale = this._locale.split(/[-_.@]/).slice(0,2).join('-');

        this._gettext.setLocale(this._locale);
        this._timezone = process.env.TZ;
        this._prefs = new Tp.Helpers.FilePreferences(this._filesDir + '/prefs.db');
        this._cacheDir = getCacheDir();
        safeMkdirSync(this._cacheDir);

        this._dbusSession = null;//DBus.sessionBus();
        if (process.env.DBUS_SYSTEM_BUS_ADDRESS || fs.existsSync('/var/run/dbus/system_bus_socket'))
            this._dbusSystem = DBus.systemBus();
        else
            this._dbusSystem = null;

        this._btApi = null;
        this._wakeWordDetector = null;

        this._media = new MediaPlayer();

        this._sqliteKey = null;
        this._origin = null;
    }

    _ensurePulseAudio() {
        if (this._pulse !== undefined)
            return;

        if (PulseAudio) {
            this._pulse = new PulseAudio();
            this._pulse.on('error', (err) => { console.error('error on PulseAudio', err); });

            if (WakeWordDetector)
                this._wakeWordDetector = new WakeWordDetector();
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
        return null;
    }

    // Check if this platform has the required capability
    // (eg. long running, big storage, reliable connectivity, server
    // connectivity, stable IP, local device discovery, bluetooth, etc.)
    //
    // Which capabilities are available affects which apps are allowed to run
    hasCapability(cap) {
        switch(cap) {
        case 'code-download':
            // If downloading code from the thingpedia server is allowed on
            // this platform
            return true;

        case 'dbus-session':
            return this._dbusSession !== null;
        case 'dbus-system':
            return this._dbusSystem !== null;

        case 'bluetooth':
            return this._dbusSystem !== null;

        case 'media-player':
            return true;

        case 'pulseaudio':
        case 'sound':
            this._ensurePulseAudio();
            return this._pulse !== null;

        case 'wakeword-detector':
            this._ensurePulseAudio();
            return this._wakeWordDetector !== null;
/*
        // We can use the phone capabilities
        case 'notify':
        case 'audio-manager':
        case 'sms':
        case 'bluetooth':
        case 'audio-router':
        case 'system-apps':
        case 'telephone':
        // for compat
        case 'notify-api':
            return true;
*/
        case 'gps':
        case 'graphics-api':
        case 'content-api':
        case 'assistant':
            return true;

        case 'gettext':
            return true;

        default:
            return false;
        }
    }

    // Retrieve an interface to an optional functionality provided by the
    // platform
    //
    // This will return null if hasCapability(cap) is false
    getCapability(cap) {
        switch(cap) {
        case 'code-download':
            // We have the support to download code
            return _unzipApi;

        case 'dbus-session':
            return this._dbusSession;
        case 'dbus-system':
            return this._dbusSystem;
        case 'bluetooth':
            if (this._dbusSystem === null)
                return null;
            if (!this._btApi)
                this._btApi = new BluezBluetooth(this);
            return this._btApi;
        case 'sound':
        case 'pulseaudio': // legacy name for "sound"
            this._ensurePulseAudio();
            return this._pulse;
        case 'wakeword-detector':
            this._ensurePulseAudio();
            return this._wakeWordDetector;
        case 'media-player':
            return this._media;
        case 'content-api':
            return _contentApi;
        case 'graphics-api':
            return _graphicsApi;
        case 'gps':
            return _gpsApi;

/*
        case 'notify-api':
        case 'notify':
            return _notifyApi;


        case 'audio-manager':
            return _audioManagerApi;

        case 'sms':
            return _smsApi;

        case 'audio-router':
            return _audioRouterApi;

        case 'system-apps':
            return _systemAppsApi;


        case 'content-api':
            return _contentApi;


        case 'telephone':
            return _telephoneApi;
*/

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
        var oldAuthToken = this._prefs.get('auth-token');
        if (oldAuthToken !== undefined && authToken !== oldAuthToken)
            return false;
        this._prefs.set('auth-token', authToken);
        return true;
    }
}
module.exports = new ServerPlatform;
