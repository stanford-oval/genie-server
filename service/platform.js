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

// Server platform, for the master process
// this is mostly to handle paths, gettext, global shared prefs
// and pulseaudio

const fs = require('fs');
const os = require('os');
const path = require('path');
const Gettext = require('node-gettext');
const PulseAudio = require('pulseaudio');

const prefs = require('thingengine-core/lib/util/prefs');

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
    init() {
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

        this._pulse = new PulseAudio({
            client: "thingengine-platform-server"
        });

        this._sqliteKey = null;
        this._origin = null;
    },

    getChildDirectory(userId) {
        return path.resolve(this._filesDir, String(userId));
    },
    getChildCacheDirectory(userId) {
        return path.resolve(this._cacheDir, String(userId));
    },

    type: 'server-master',

    get encoding() {
        return 'utf8';
    },

    get locale() {
        return this._locale;
    },

    get timezone() {
        return this._timezone;
    },

    hasCapability(cap) {
        switch(cap) {
        case 'pulseaudio':
            return true;
        case 'gettext':
            return true;

        default:
            return false;
        }
    },
    getCapability(cap) {
        switch(cap) {
        case 'pulseaudio':
            return this._pulse;
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
        return this._filesDir + '/master.db';
    },

    _setSqliteKey(key) {
        this._sqliteKey = key.toString('hex');
    },

    getSqliteKey() {
        return this._sqliteKey;
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

    // Stub methods follow

    hasFeature(feature) {
        return false;
    },
    getPlatformDevice() {
        return null;
    },
    getDeveloperKey() {
        return null;
    },
    setDeveloperKey(key) {
        return false;
    },
    getCloudId() {
        return null;
    },
    getAuthToken() {
        return null;
    },
    setAuthToken(authToken) {
        return false;
    }
};
