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

const os = require('os');
const express = require('express');
var router = express.Router();

// FIXME
const ipAddress = require('thingengine-core/lib/util/ip_address');
const user = require('../util/user');
const platform = require('../service/platform');

router.get('/', user.redirectLogIn, (req, res, next) => {
    ipAddress.getServerName().then((host) => {
        var port = res.app.get('port');

        var prefs = platform.getSharedPreferences();
        var cloudId = prefs.get('cloud-id');
        var authToken = prefs.get('auth-token');

        if (host !== os.hostname())
            var name = os.hostname() + " (" + host + ")";
        res.render('index', { page_title: "Almond - The Open Virtual Assistant",
                              server: { name: name,
                                        port: port,
                                        initialSetup: authToken === undefined },
                              cloud: { isConfigured: cloudId !== undefined } });
    }).catch(next);
});

router.get('/conversation', user.redirectLogIn, (req, res, next) => {
    res.render('conversation', { page_title: req._("Almond - Chat") });
});

router.get('/widgets', user.redirectLogIn, (req, res, next) => {
    res.render('brassau', { page_title: req._("Almond - Widgets") });
});

router.get('/friendhub', user.redirectLogIn, (req, res, next) => {
    res.render('friendhub', { page_title: req._("FriendHub")});
});

module.exports = router;
