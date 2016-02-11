// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

// Server platform

const Q = require('q');
const fs = require('fs');
const os = require('os');
const path = require('path');
const posix = require('posix');
const child_process = require('child_process');

const sql = require('./engine/db/sql');
const graphics = require('./graphics');

var Config;
try {
Config = require('./platform_config');
} catch(e) {
Config = {};
}
const prefs = require('./engine/prefs');

var AllJoynApi;
try {
    throw new Error('AllJoyn is disabled');
    AllJoynApi = require('./alljoyn');
} catch(e) {
    AllJoynApi = null;
}

const BluezBluetooth = require('./bluez');
var _btApi = null;

var _writabledir = null;
var _frontend = null;
var _prefs = null;

function dropCaps() {
    process.initgroups('thingengine', 'thingengine');
    process.setgid('thingengine');
    process.setuid('thingengine');
}

function mkdirWithParentsSync(dir) {
    var parent = path.dirname(dir);
    if (!fs.existsSync(parent))
        mkdirWithParentsSync(parent);

    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if (e.code != 'EEXIST')
            throw e;
    }
}

function checkLocalStateDir() {
    mkdirWithParentsSync(_writabledir);
    var pw = posix.getpwnam('thingengine');
    fs.chownSync(_writabledir, pw.uid, pw.gid);
    fs.chmodSync(_writabledir, 0700);
}

var _unzipApi = {
    unzip: function(zipPath, dir) {
        var args = ['-uo', zipPath, '-d', dir];
        return Q.nfcall(child_process.execFile, '/usr/bin/unzip', args).then(function(zipResult) {
            var stdout = zipResult[0];
            var stderr = zipResult[1];
            console.log('stdout', stdout);
            console.log('stderr', stderr);
        });
    }
};

module.exports = {
    // Initialize the platform code
    // Will be called before instantiating the engine
    init: function() {
        _writabledir = Config.LOCALSTATEDIR;
        if (process.getuid() == 0) {
            checkLocalStateDir();
            dropCaps();
        }
        try {
            fs.mkdirSync(_writabledir + '/cache');
        } catch(e) {
            if (e.code != 'EEXIST')
                throw e;
        }

        _prefs = new prefs.FilePreferences(_writabledir + '/prefs.db');

        return sql.ensureSchema(_writabledir + '/sqlite.db',
                                'schema.sql');
    },

    type: 'server',

    // Check if this platform has the required capability
    // (eg. long running, big storage, reliable connectivity, server
    // connectivity, stable IP, local device discovery, bluetooth, etc.)
    //
    // Which capabilities are available affects which apps are allowed to run
    hasCapability: function(cap) {
        switch(cap) {
        case 'code-download':
            // If downloading code from the thingpedia server is allowed on
            // this platform
            return true;

        case 'alljoyn':
            return AllJoynApi !== null;

        case 'bluetooth':
            return os.platform() === 'linux';

        case 'graphics-api':
            return true;

        default:
            return false;
        }
    },

    // Retrieve an interface to an optional functionality provided by the
    // platform
    //
    // This will return null if hasCapability(cap) is false
    getCapability: function(cap) {
        switch(cap) {
        case 'code-download':
            // We have the support to download code
            return _unzipApi;

        case 'alljoyn':
            return new AllJoynApi();

        case 'bluetooth':
            if (!_btApi)
                _btApi = new BluezBluetooth();
            return _btApi;

        case 'graphics-api':
            return graphics;

        default:
            return null;
        }
    },

    // Obtain a shared preference store
    // Preferences are simple key/value store which is shared across all apps
    // but private to this instance (tier) of the platform
    // Preferences should be normally used only by the engine code, and a persistent
    // shared store such as DataVault should be used by regular apps
    getSharedPreferences: function() {
        return _prefs;
    },

    // Get the root of the application
    // (In android, this is the virtual root of the APK)
    getRoot: function() {
        return process.cwd();
    },

    // Get a directory that is guaranteed to be writable
    // (in the private data space for Android, in /var/lib for server)
    getWritableDir: function() {
        return _writabledir;
    },

    // Get a directory good for long term caching of code
    // and metadata
    getCacheDir: function() {
        return _writabledir + '/cache';
    },

    // Make a symlink potentially to a file that does not exist physically
    makeVirtualSymlink: function(file, link) {
        fs.symlinkSync(file, link);
    },

    // Get a temporary directory
    // Also guaranteed to be writable, but not guaranteed
    // to persist across reboots or for long times
    // (ie, it could be periodically cleaned by the system)
    getTmpDir: function() {
        return os.tmpdir();
    },

    // Get the filename of the sqlite database
    getSqliteDB: function() {
        return _writabledir + '/sqlite.db';
    },

    // Stop the main loop and exit
    // (In Android, this only stops the node.js thread)
    // This function should be called by the platform integration
    // code, after stopping the engine
    exit: function() {
        return process.exit();
    },

    // Get the ThingPedia developer key, if one is configured
    getDeveloperKey: function() {
        return _prefs.get('developer-key');
    },

    // Change the ThingPedia developer key, if possible
    // Returns true if the change actually happened
    setDeveloperKey: function(key) {
        return _prefs.set('developer-key', key);
        return true;
    },

    // Return a server/port URL that can be used to refer to this
    // installation. This is primarily used for OAuth redirects, and
    // so must match what the upstream services accept.
    getOrigin: function() {
        return 'http://127.0.0.1:3000';
    },

    // Change the auth token
    // Returns true if a change actually occurred, false if the change
    // was rejected
    setAuthToken: function(authToken) {
        var oldAuthToken = _prefs.get('auth-token');
        if (oldAuthToken !== undefined && authToken !== oldAuthToken)
            return false;
        _prefs.set('auth-token', authToken);
        return true;
    },

    // For internal use only
    _setFrontend: function(frontend) {
        _frontend = frontend;
    },

    _getPrivateFeature: function(name) {
        switch(name) {
        case 'frontend-express':
            return _frontend.getApp();
        default:
            throw new Error('Invalid private feature name (what are you trying to do?)');
        }
    },

};
