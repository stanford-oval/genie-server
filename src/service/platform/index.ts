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

/// <reference types="./pulseaudio2" />
/// <reference types="./canberra" />

import * as fs from 'fs';
import * as os from 'os';
import * as events from 'events';
import * as Tp from 'thingpedia';
import * as child_process from 'child_process';
import Gettext from 'node-gettext';
import * as path from 'path';
import * as util from 'util';
import * as Genie from 'genie-toolkit';

import * as _graphicsApi from './graphics';

import type PulseAudio_ from 'pulseaudio2';
let PulseAudio : typeof PulseAudio_|null = null;

import type * as canberra_ from 'canberra';
let canberra : typeof canberra_|null = null;

import type WakeWordDetector_ from '../wake-word/snowboy';
let WakeWordDetector : typeof WakeWordDetector_|null = null;

import type webrtcvad_ from 'webrtcvad';
let webrtcvad : typeof webrtcvad_|null = null;

// FIXME
import Builtins from 'genie-toolkit/dist/lib/engine/devices/builtins';
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

// A simple Audio Player based on GStreamer
class Player extends events.EventEmitter implements Tp.Capabilities.Player {
    private _child : child_process.ChildProcess;

    constructor(child : child_process.ChildProcess) {
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

const _audioPlayerApi : Tp.Capabilities.AudioPlayerApi = {
    async play(urls : string[]) {
        return new Player(child_process.spawn('gst-play-1.0', [ "-q" ].concat(urls), {
            stdio: ['ignore', process.stdout, process.stderr]
        }));
    }
};

const LOCAL_SOUND_EFFECTS = ['news-intro'];
const KNOWN_SOUND_EFFECTS = ['alarm-clock-elapsed', 'audio-channel-front-center', 'audio-channel-front-left', 'audio-channel-front-right', 'audio-channel-rear-center', 'audio-channel-rear-left', 'audio-channel-rear-right', 'audio-channel-side-left', 'audio-channel-side-right', 'audio-test-signal', 'audio-volume-change', 'bell', 'camera-shutter', 'complete', 'device-added', 'device-removed', 'dialog-error', 'dialog-information', 'dialog-warning', 'message-new-instant', 'message', 'network-connectivity-established', 'network-connectivity-lost', 'phone-incoming-call', 'phone-outgoing-busy', 'phone-outgoing-calling', 'power-plug', 'power-unplug', 'screen-capture', 'service-login', 'service-logout', 'suspend-error', 'trash-empty', 'window-attention', 'window-question'];

const SOUND_EFFECT_ID = 0;
export class SoundEffectsApi implements Tp.Capabilities.SoundEffectsApi {
    private _ctx : canberra_.Context;

    constructor() {
        this._ctx = new canberra!.Context({
            [canberra!.Property.APPLICATION_ID]: 'edu.stanford.Almond',
        });

        try {
            this._ctx.cache({
                'media.role': 'voice-assistant',
                [canberra!.Property.EVENT_ID]: 'message-new-instant'
            });

            this._ctx.cache({
                'media.role': 'voice-assistant',
                [canberra!.Property.EVENT_ID]: 'dialog-warning'
            });
        } catch(e) {
            console.error(`Failed to cache event sound: ${e.message}`);
        }
    }

    getURL(name : string) {
        if (LOCAL_SOUND_EFFECTS.includes(name))
            return 'file://' + path.resolve(path.dirname(module.filename), '../../../data/sound-effects/' + name + '.oga');
        else if (KNOWN_SOUND_EFFECTS.includes(name))
            return 'file:///usr/share/sounds/freedesktop/stereo/' + name + '.oga';
        else
            return undefined;
    }

    play(name : string, id = SOUND_EFFECT_ID) {
        const options : Record<string, string> = {
            'media.role': 'voice-assistant',
        };
        if (LOCAL_SOUND_EFFECTS.includes(name))
            options['media.filename'] = path.resolve(path.dirname(module.filename), '../../../data/sound-effects/' + name + '.oga');
        else
            options['event.id'] = name;

        return this._ctx.play(id, options);
    }
}

class VAD implements Tp.Capabilities.VadApi {
    private _instance : webrtcvad_|null;
    private _previousChunk : Buffer|null;
    frameSize : number;

    constructor() {
        this._instance = null;
        this._previousChunk = null;
        this.frameSize = 0;
    }

    setup(bitrate : number, level ?: number) {
        if (this._instance)
            this._instance = null;

        if (webrtcvad) {
            this._instance = new webrtcvad(bitrate, level);
            // 16khz audio single-channel 16 bit: 10ms: 160b, 20ms: 320b, 30ms: 480b
            this.frameSize = 320;
            // console.log("setup VAD bitrate", bitrate, "level", level);
            return true;
        }

        return false;
    }

    process(chunk : Buffer) {
        if (!this._instance)
            return false;

        if (this._previousChunk)
            chunk = Buffer.concat([this._previousChunk, chunk], this._previousChunk.length + chunk.length);

        let anySound = false;
        let offset : number;
        for (offset = 0; offset < chunk.length && offset + this.frameSize <= chunk.length; offset += this.frameSize) {
            const sliced = chunk.slice(offset, offset + this.frameSize);
            const sound = this._instance.process(sliced);
            anySound = anySound || sound;
        }
        if (offset < chunk.length)
            this._previousChunk = chunk.slice(offset);
        else
            this._previousChunk = null;
        return anySound;
    }
}

export class ServerPlatform extends Tp.BasePlatform {
    private _gettext : Gettext;
    private _filesDir : string;
    private _locale : string;
    private _timezone : string;
    private _prefs : Tp.Preferences;
    private _cacheDir : string;
    private _wakeWordDetector : WakeWordDetector_|null;
    private _voiceDetector : VAD|null;
    private _soundEffects : SoundEffectsApi|null;
    private _sqliteKey : string|null;
    private _origin : string|null;
    private _pulse : PulseAudio_|null|undefined;
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

        this._timezone = process.env.TZ!;
        this._prefs = new Tp.Helpers.FilePreferences(this._filesDir + '/prefs.db');
        this._cacheDir = getCacheDir();
        safeMkdirSync(this._cacheDir);

        this._wakeWordDetector = null;
        this._voiceDetector = null;
        this._soundEffects = null;
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

    async init() {
        try {
            PulseAudio = (await import('pulseaudio2')).default;
        } catch(e) {
            PulseAudio = null;
        }
        try {
            canberra = (await import('canberra'));
        } catch(e) {
            canberra = null;
        }
        try {
            WakeWordDetector = (await import('../wake-word/snowboy')).default;
        } catch(e) {
            WakeWordDetector = null;
        }

        try {
            webrtcvad = (await import('webrtcvad')).default;
        } catch(e) {
            console.log("VAD not available");
            webrtcvad = null;
        }
    }

    async _ensurePulseConfig() {
        try {
            let hasFilterHeuristics = false, hasFilterApply = false;
            const pulseModList = await this._pulse!.modules();
            for (let i = 0; i < pulseModList.length; i++) {
                const mod = pulseModList[i];
                if (mod.name === 'module-filter-heuristics')
                    hasFilterHeuristics = true;
                if (mod.name === 'module-filter-apply')
                    hasFilterApply = true;
                if (mod.name === 'module-role-ducking')
                    await this._pulse!.unloadModule(mod.index);
            }
            if (!hasFilterHeuristics)
                await this._pulse!.loadModule("module-filter-heuristics");
            if (!hasFilterApply)
                await this._pulse!.loadModule("module-filter-apply");
            await this._pulse!.loadModule("module-role-ducking", "trigger_roles=voice-assistant ducking_roles=music volume=40% global=true");
        } catch(e) {
            console.error("failed to configure PulseAudio");
        }
    }

    private _ensurePulseAudio() {
        if (this._pulse !== undefined)
            return;

        if (PulseAudio) {
            this._pulse = new PulseAudio();
            this._pulse.on('error', (err : Error) => { console.error('error on PulseAudio', err); });
            this._pulse.on('connection', () => {
                this._ensurePulseConfig();
            });

            if (WakeWordDetector)
                this._wakeWordDetector = new WakeWordDetector();

            if (canberra)
                this._soundEffects = new SoundEffectsApi();

            if (webrtcvad && VAD)
                this._voiceDetector = new VAD();
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

        case 'pulseaudio':
        case 'sound':
            this._ensurePulseAudio();
            return this._pulse !== null;

        case 'wakeword-detector':
            this._ensurePulseAudio();
            return this._wakeWordDetector !== null;
        case 'voice-detector':
            return this._voiceDetector !== null;

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
    getCapability<T extends keyof Tp.Capabilities.CapabilityMap>(cap : T) : Tp.Capabilities.CapabilityMap[T] {
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
        case 'voice-detector':
            return this._voiceDetector;
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
