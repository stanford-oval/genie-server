// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const crypto = require('crypto');
const Q = require('q');

module.exports = {
    getSecretKey: function() {
        var prefs = platform.getSharedPreferences();

        var sessionKey = prefs.get('session-key');
        if (sessionKey === undefined) {
            sessionKey = crypto.randomBytes(32).toString('hex');
            prefs.set('session-key', sessionKey);
        }
        return sessionKey;
    },
};
