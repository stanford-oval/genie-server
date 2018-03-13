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

const Q = require('q');
const express = require('express');
var router = express.Router();

// FIXME
const ipAddress = require('thingengine-core/lib/util/ip_address');
const user = require('../util/user');

function config(req, res, next, userData, cloudData) {
    return ipAddress.getServerName().then(function(host) {
        var port = res.app.get('port');
        var serverAddress = 'http://' +
            (host.indexOf(':' >= 0) ? '[' + host + ']' : host)
            + ':' + port + '/config';

        var prefs = platform.getSharedPreferences();
        var cloudId = prefs.get('cloud-id');
        var authToken = prefs.get('auth-token');

        var qrcodeTarget = 'https://thingengine.stanford.edu/qrcode/' + host + '/'
            + port + '/' + authToken;

        var ipAddresses = ipAddress.getServerAddresses(host);
        res.render('config', { page_title: "Configure Almond",
                               csrfToken: req.csrfToken(),
                               server: { name: host, port: port,
                                         address: serverAddress,
                                         extraAddresses: ipAddresses,
                                         initialSetup: authToken === undefined },
                               user: { isConfigured: user.isConfigured(),
                                       username: userData.username || req.user,
                                       password: userData.password,
                                       error: userData.error },
                               cloud: { isConfigured: cloudId !== undefined,
                                        error: cloudData.error,
                                        username: cloudData.username,
                                        id: cloudId },
                               qrcodeTarget: qrcodeTarget });
    });
}

router.get('/', user.redirectLogIn, function(req, res, next) {
    config(req, res, next, {}, {}).done();
});

router.post('/set-server-password', user.requireLogIn, function(req, res, next) {
    var password;
    try {
        if (typeof req.body['password'] !== 'string' ||
            req.body['password'].length < 8 ||
            req.body['password'].length > 255)
            throw new Error("You must specifiy a valid password (of at least 8 characters)");

        if (req.body['confirm-password'] !== req.body['password'])
            throw new Error("The password and the confirmation do not match");
        password = req.body['password'];

    } catch(e) {
        config(req, res, next, { password: '',
                                 error: e.message }, {}).done();
        return;
    }

    user.register(password).then(function(userObj) {
        user.unlock(req, password);
        return Q.ninvoke(req, 'login', userObj);
    }).then(function() {
        res.redirect('/config');
    }).catch(function(error) {
        return config(req, res, next, { password: '',
                                        error: error.message }, {});
    });
});

module.exports = router;
