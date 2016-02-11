// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Config = require('../../engine/config');

const Q = require('q');
const http = require(Config.THINGENGINE_ACCESS_MODULE);
const httpStatusCodes = require('http').STATUS_CODES;
const url = require('url');
const express = require('express');
var router = express.Router();

const ipAddress = require('../../engine/util/ip_address');
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
        res.render('config', { page_title: "ThingEngine - run your things!",
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
    var username, password;
    try {
        if (typeof req.body['username'] !== 'string' ||
            req.body['username'].length == 0 ||
            req.body['username'].length > 255)
            throw new Error("You must specify a valid username");
        username = req.body['username'];

        if (typeof req.body['password'] !== 'string' ||
            req.body['password'].length < 8 ||
            req.body['password'].length > 255)
            throw new Error("You must specifiy a valid password (of at least 8 characters)");

        if (req.body['confirm-password'] !== req.body['password'])
            throw new Error("The password and the confirmation do not match");
        password = req.body['password'];

    } catch(e) {
        config(req, res, next, { username: username,
                                 password: '',
                                 error: e.message }, {}).done();
        return;
    }

    user.register(username, password).then(function(user) {
        return Q.ninvoke(req, 'login', user);
    }).then(function() {
        res.redirect('/config');
    }).catch(function(error) {
        return config(req, res, next, { username: username,
                                        password: '',
                                        error: error.message }, {});
    });
});

function setCloudId(engine, cloudId, authToken) {
    if (engine.devices.hasDevice('thingengine-own-cloud'))
        return false;
    if (!platform.setAuthToken(authToken))
        return false;

    engine.devices.loadOneDevice({ kind: 'thingengine',
                                   tier: 'cloud',
                                   cloudId: cloudId,
                                   own: true }, true).done();
    return true;
}

router.post('/cloud-setup', user.requireLogIn, function(req, res, next) {
    try {
        var username = req.body.username;
        if (!username)
            throw new Error("Missing username");

        var password = req.body.password;
        if (!password)
            throw new Error("Missing password");

        var postData = 'username=' + encodeURIComponent(username)
            + '&password=' + encodeURIComponent(password);

        var request = url.parse(Config.THINGENGINE_URL + '/api/login');
        request.method = 'POST';
        request.headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        };

        var ajax = http.request(request);

        ajax.on('error', function(e) {
            config(req, res, next, {}, { error: e.message,
                                         username: username });
        });
        ajax.on('response', function(response) {
            if (response.statusCode != 200) {
                ajax.abort();
                config(req, res, next, {}, { error: httpStatusCodes[response.statusCode],
                                             username: username }).done();
                return;
            }

            var buffer = '';
            response.on('data', function(incoming) {
                buffer += incoming.toString('utf8');
            });
            response.on('end', function() {
                try {
                    var json = JSON.parse(buffer);
                    if (json.success) {
                        setCloudId(res.app.engine, json.cloudId, json.authToken);
                        res.redirect('/config');
                    } else {
                        config(req, res, next, {}, { error: json.error,
                                                     username: username }).done();
                    }
                } catch(e) {
                    config(req, res, next, {}, { error: e.message,
                                                 username: username }).done();
                }
            });
        });
        ajax.end(postData);
    } catch(e) {
        config(req, res, next, {}, { error: e.message,
                                     username: username }).done();
    }
});

module.exports = router;
