// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015-2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// Server platform

const Q = require('q');
const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const Gettext = require('node-gettext');
const DBus = require('dbus-native');
let PulseAudio;
try {
    PulseAudio = require('pulseaudio2');
} catch(e) {
    PulseAudio = null;
}

const prefs = require('thingengine-core/lib/util/prefs');

const BluezBluetooth = require('./bluez');
let SpeechSynthesizer;
try {
    SpeechSynthesizer = require('./speech_synthesizer');
} catch(e) {
    SpeechSynthesizer = null;
}
const MediaPlayer = require('./media_player');

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
const _graphicsApi = require('./graphics');

const _contentJavaApi = JavaAPI.makeJavaAPI('Content', [], ['getStream'], []);
const _contentApi = {
    getStream(url) {
        return _contentJavaApi.getStream(url).then(function(token) {
            return StreamAPI.get().createStream(token);
        });
    }
}
const _contactApi = JavaAPI.makeJavaAPI('Contacts', ['lookup'], [], []);
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
    if (process.env.XDG_CONFIG_HOME)
        return process.env.XDG_CONFIG_HOME;
    return os.homedir() + '/.config';
}
function getUserCacheDir() {
    if (process.env.XDG_CACHE_HOME)
        return process.env.XDG_CACHE_HOME;
    return os.homedir() + '/.cache';
}

module.exports = {
    // Initialize the platform code
    // Will be called before instantiating the engine
    init: function() {
        this._assistant = null;

        this._gettext = new Gettext();

        this._filesDir = getUserConfigDir() + '/almond-server';
        safeMkdirSync(this._filesDir);
        this._locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || 'en-US';
        // normalize this._locale to something that Intl can grok
        this._locale = this._locale.split(/[-_.@]/).slice(0,2).join('-');

        this._gettext.setLocale(this._locale);
        this._timezone = process.env.TZ;
        this._prefs = new prefs.FilePreferences(this._filesDir + '/prefs.db');
        this._cacheDir = getUserCacheDir() + '/almond-server';
        safeMkdirSync(this._cacheDir);

        this._dbusSession = null;//DBus.sessionBus();
        this._dbusSystem = DBus.systemBus();
        this._btApi = null;
        if (PulseAudio) {
            this._pulse = new PulseAudio({
                client: "thingengine-platform-server"
            });
            if (SpeechSynthesizer)
                this._tts = new SpeechSynthesizer(this._pulse, path.resolve(module.filename, '../../data/cmu_us_slt.flitevox'));
            else
                this._tts = null;
        } else {
            this._pulse = null;
            this._tts = null;
        }
        
        this._media = new MediaPlayer();

        this._sqliteKey = null;
        this._origin = null;
    },

    setAssistant(ad) {
        this._assistant = ad;
    },

    type: 'server',

    get encoding() {
        return 'utf8';
    },

    get locale() {
        return this._locale;
    },

    get timezone() {
        return this._timezone;
    },

    // Check if we need to load and run the given thingengine-module on
    // this platform
    // (eg we don't need discovery on the cloud, and we don't need graphdb,
    // messaging or the apps on the phone client)
    hasFeature(feature) {
        switch(feature) {
        case 'ui':
            return false;

        default:
            return true;
        }
    },

    getPlatformDevice() {
        return 'home';
    },

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
            return false;
        case 'dbus-system':
            return true;
        case 'text-to-speech':
            return this._tts !== null;

        case 'bluetooth':
        case 'media-player':
            return true;

        case'pulseaudio':
            return this._pulse !== null;
/*
        // We can use the phone capabilities
        case 'notify':
        case 'gps':
        case 'audio-manager':
        case 'sms':
        case 'bluetooth':
        case 'audio-router':
        case 'system-apps':
        case 'graphics-api':
        case 'contacts':
        case 'telephone':
        // for compat
        case 'notify-api':
            return true;
*/
        case 'content-api':
        case 'assistant':
            return true;

        case 'gettext':
            return true;

        default:
            return false;
        }
    },

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
        case 'text-to-speech':
            return this._tts;
        case 'bluetooth':
            if (!this._btApi)
                this._btApi = new BluezBluetooth(this);
            return this._btApi;
        case 'pulseaudio':
            return this._pulse;
        case 'media-player':
            return this._media;
        case 'content-api':
            return _contentApi;

/*
        case 'notify-api':
        case 'notify':
            return _notifyApi;

        case 'gps':
            return _gpsApi;

        case 'audio-manager':
            return _audioManagerApi;

        case 'sms':
            return _smsApi;

        case 'audio-router':
            return _audioRouterApi;

        case 'system-apps':
            return _systemAppsApi;

        case 'graphics-api':
            return _graphicsApi;

        case 'content-api':
            return _contentApi;

        case 'contacts':
            return _contactApi;

        case 'telephone':
            return _telephoneApi;
*/

        case 'assistant':
            return this._assistant;

        case 'gettext':
            return this._gettext;

        default:
            return null;
        }
    },

    // Obtain a shared preference store
    // Preferences are simple key/value store which is shared across all apps
    // but private to this instance (tier) of the platform
    // Preferences should be normally used only by the engine code, and a persistent
    // shared store such as DataVault should be used by regular apps
    getSharedPreferences() {
        return this._prefs;
    },

    // Get a directory that is guaranteed to be writable
    // (in the private data space for Android)
    getWritableDir() {
        return this._filesDir;
    },

    // Get a temporary directory
    // Also guaranteed to be writable, but not guaranteed
    // to persist across reboots or for long times
    // (ie, it could be periodically cleaned by the system)
    getTmpDir() {
        return os.tmpdir();
    },

    // Get a directory good for long term caching of code
    // and metadata
    getCacheDir() {
        return this._cacheDir;
    },

    // Get the filename of the sqlite database
    getSqliteDB() {
        return this._filesDir + '/sqlite.db';
    },

    _setSqliteKey(key) {
        this._sqliteKey = key.toString('hex');
    },

    getSqliteKey() {
        return this._sqliteKey;
    },

    getGraphDB() {
        return this._filesDir + '/rdf.db';
    },

    // Stop the main loop and exit
    // (In Android, this only stops the node.js thread)
    // This function should be called by the platform integration
    // code, after stopping the engine
    exit() {
        process.exit();
    },

    // Get the ThingPedia developer key, if one is configured
    getDeveloperKey() {
        return this._prefs.get('developer-key');
    },

    // Change the ThingPedia developer key, if possible
    // Returns true if the change actually happened
    setDeveloperKey(key) {
        return this._prefs.set('developer-key', key);
    },

    // Return a server/port URL that can be used to refer to this
    // installation. This is primarily used for OAuth redirects, and
    // so must match what the upstream services accept.
    _setOrigin(origin) {
        this._origin = origin;
    },

    getOrigin() {
        return this._origin;
    },

    getCloudId() {
        return this._prefs.get('cloud-id');
    },

    getAuthToken() {
        return this._prefs.get('auth-token');
    },

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
};
