// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
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

import * as fs from 'fs';
import * as os from 'os';
import * as Tp from 'thingpedia';
import * as child_process from 'child_process';
import Gettext from 'node-gettext';
import * as path from 'path';
import * as util from 'util';
import * as Genie from 'genie-toolkit';
import { Temporal } from '@js-temporal/polyfill';

import * as _graphicsApi from './graphics';

// FIXME
import { modules as Builtins } from 'genie-toolkit/dist/lib/engine/devices/builtins';
import ThingEngineServerDevice from './thingengine.server';

import * as Config from '../../config';

const _unzipApi : Tp.Capabilities.UnzipApi = {
    unzip(zipPath, dir) {
        const args = ['-uo', zipPath, '-d', dir];
        return util.promisify(child_process.execFile)('/usr/bin/unzip', args, {
            maxBuffer: 10 * 1024 * 1024 }).then(({ stdout, stderr }) => {
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

const _contentApi : Tp.Capabilities.ContentApi = {
    getStream(url) {
        return new Promise((resolve, reject) => {
            if (url.startsWith('file:///')) {
                const path = url.substring('file://'.length);
                child_process.execFile('xdg-mime', ['query', 'filetype', path], (err, stdout, stderr) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const stream : Tp.Helpers.Content.ContentTypeStream = fs.createReadStream(path);
                    stream.contentType = String(stdout).trim();
                    resolve(stream);
                });
            } else {
                reject(new Error('Unsupported url ' + url));
            }
        });
    }
};

function safeMkdirSync(dir : string) {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if (e.code !== 'EEXIST')
            throw e;
    }
}

function getUserConfigDir() {
    if (process.platform === 'win32')
        return process.env.APPDATA!;
    if (process.env.XDG_CONFIG_HOME)
        return process.env.XDG_CONFIG_HOME;
    return os.homedir() + '/.config';
}
function getUserCacheDir() {
    if (process.platform === 'win32')
        return process.env.TEMP!;
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

class GpsApi implements Tp.Capabilities.GpsApi {
    private _location : Tp.Capabilities.Location|null = null;
    onlocationchanged : ((loc : Tp.Capabilities.Location) => void)|null = null;

    async start() {}
    async stop() {}

    setLocation(v : Tp.Capabilities.Location) {
        this._location = v;
        if (this.onlocationchanged)
            this.onlocationchanged(v);
    }

    async getCurrentLocation() {
        return this._location!;
    }
}
const _gpsApi = new GpsApi;

export class ServerPlatform extends Tp.BasePlatform {
    private _gettext : Gettext;
    private _filesDir : string;
    private _locale : string;
    private _timezone : string;
    private _prefs : Tp.Preferences;
    private _cacheDir : string;
    private _sqliteKey : string|null;
    private _origin : string|null;
    speech : Genie.SpeechHandler|null;

    private _serverDev : {
        kind : string;
        class : string;
        module : Tp.BaseDevice.DeviceClass<ThingEngineServerDevice>
    };

    constructor() {
        super();

        this._gettext = new Gettext();

        this._filesDir = getFilesDir();
        safeMkdirSync(this._filesDir);

        let locale = 'en-US';
        if (process.env.LOCALE)
            locale = process.env.LOCALE;
        this._locale = locale;
        // normalize this._locale to something that Intl can grok
        this._locale = this._locale.split(/[-_.@]/).slice(0, 2).join('-');
        this._gettext.setLocale(this._locale);

        this._timezone = Temporal.Now.timeZone().id;
        this._prefs = new Tp.Helpers.FilePreferences(this._filesDir + '/prefs.db');
        this._cacheDir = getCacheDir();
        safeMkdirSync(this._cacheDir);

        this.speech = null;

        this._sqliteKey = null;
        this._origin = null;

        this._serverDev = {
            kind: 'org.thingpedia.builtin.thingengine.server',
            class: fs.readFileSync(path.resolve(__dirname, '../../../data/thingengine.server.tt')).toString(),
            module: ThingEngineServerDevice
        };

        // HACK: thingengine-core will try to load thingengine-own-desktop from the db
        // before PairedEngineManager calls getPlatformDevice(), which can result in loading
        // the device as unsupported (and that would be bad)
        // to avoid that, we inject it eagerly here
        (Builtins as any)[this._serverDev.kind] = this._serverDev;
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
    hasFeature(feature : string) {
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
    hasCapability(cap : string) {
        switch (cap) {
        case 'code-download':
        case 'gps':
        case 'graphics-api':
        case 'content-api':
        case 'audio-player':
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
    getCapability<T extends keyof Tp.Capabilities.CapabilityMap>(cap : T) : Tp.Capabilities.CapabilityMap[T] {
        switch (cap) {
        case 'code-download':
            // We have the support to download code
            return _unzipApi;

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

    _setSqliteKey(key : Buffer) {
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
        return this._prefs.get('developer-key') as string|undefined ?? null;
    }

    // Change the ThingPedia developer key, if possible
    // Returns true if the change actually happened
    setDeveloperKey(key : string|null) {
        return this._prefs.set('developer-key', key);
    }

    _setOrigin(origin : string) {
        this._origin = origin;
    }

    getOAuthRedirect() {
        return Config.OAUTH_REDIRECT_URL;
    }

    getOrigin() : string {
        if (process.env.THINGENGINE_ORIGIN)
            return process.env.THINGENGINE_ORIGIN;
        return this._origin!;
    }

    getCloudId() {
        return this._prefs.get('cloud-id') as string|undefined ?? null;
    }

    getAuthToken() {
        return this._prefs.get('auth-token') as string|undefined;
    }

    // Change the auth token
    // Returns true if a change actually occurred, false if the change
    // was rejected
    setAuthToken(authToken : string) {
        const oldAuthToken = this._prefs.get('auth-token');
        if (oldAuthToken !== undefined && authToken !== oldAuthToken)
            return false;
        this._prefs.set('auth-token', authToken);
        return true;
    }
}

export default new ServerPlatform();
