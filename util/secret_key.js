// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const crypto = require('crypto');
const platform = require('../service/platform');

module.exports = {
    getSecretKey() {
        var prefs = platform.getSharedPreferences();

        var sessionKey = prefs.get('session-key');
        if (sessionKey === undefined) {
            sessionKey = crypto.randomBytes(32).toString('hex');
            prefs.set('session-key', sessionKey);
        }
        return sessionKey;
    },
};
