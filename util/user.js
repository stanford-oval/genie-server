// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016-2019 The Board of Trustees of the Leland Stanford Junior University
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
"use strict";

const crypto = require('crypto');
const util = require('util');
const passport = require('passport');
const BaseStrategy = require('passport-strategy');
const LocalStrategy = require('passport-local').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;

const platform = require('../service/platform');
const Config = require('../config');

// a model of user based on sharedpreferences
const model = {
    isConfigured() {
        const prefs = platform.getSharedPreferences();
        const user = prefs.get('server-login');
        return user !== undefined;
    },

    get() {
        const prefs = platform.getSharedPreferences();
        const user = prefs.get('server-login');
        if (user === undefined)
            throw new Error("Login not configured yet");
        return user;
    },

    set(salt, sqliteKeySalt, passwordHash) {
        const prefs = platform.getSharedPreferences();
        const user = { password: passwordHash,
                       salt: salt,
                       sqliteKeySalt: sqliteKeySalt };
        prefs.set('server-login', user);
        return user;
    }
};

class HostBasedStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'host-based';

        this._mode = Config.HOST_BASED_AUTHENTICATION;
        if (['disabled', 'local-ip', 'proxied-ip', 'insecure'].indexOf(this._mode) < 0)
            throw new Error(`Configuration error: invalid value ${this._mode} for HOST_BASED_AUTHENTICATION setting`);
    }

    authenticate(req, options) {
        // if the server is not configured, disable HBA and let the user set the password
        if (!model.isConfigured())
            return this.pass();
        // if the engine is still locked (DB encryption is on), we need the user to enter their password
        if (req.isLocked)
            return this.pass();

        // otherwise, we allow if mode is insecure (all IPs are OK), or if the IP is local
        // whether the IP is the proxy/direct client, or the proxied client depends on the "trust proxy" setting
        if (this._mode === 'insecure' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1' || req.ip === '::1')
            return this.success(model.get());
        else
            return this.pass();
    }
}

function makeRandom() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(salt, password) {
    return util.promisify(crypto.pbkdf2)(password, salt, 10000, 32, 'sha1')
        .then((buffer) => buffer.toString('hex'));
}

function initializePassport() {
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    passport.use(new HostBasedStrategy());

    passport.use(new BearerStrategy((accessToken, done) => {
        Promise.resolve().then(() => {
            try {
                const prefs = platform.getSharedPreferences();
                const expectedAccessToken = prefs.get('access-token');
                if (crypto.timingSafeEqual(new Buffer(accessToken, 'hex'), new Buffer(expectedAccessToken, 'hex')))
                    return [model.get(), null];
                return [false, "Invalid access token"];
            } catch(e) {
                return [false, e.message];
            }
        }).then((result) => {
            done(null, result[0], { message: result[1] });
        }, (err) => {
            done(err);
        });
    }));

    passport.use(new LocalStrategy((username, password, done) => {
        Promise.resolve().then(() => {
            try {
                var user = model.get();

                return hashPassword(user.salt, password).then((hash) => {
                    if (!crypto.timingSafeEqual(new Buffer(hash, 'hex'), new Buffer(user.password, 'hex')))
                        return [false, "Invalid username or password"];

                    return ['local', null];
                });
            } catch(e) {
                return [false, e.message];
            }
        }).then((result) => {
            done(null, result[0], { message: result[1] });
        }, (err) => {
            done(err);
        });
    }));
}

module.exports = {
    initializePassport: initializePassport,

    isConfigured() {
        return model.isConfigured();
    },

    register(password) {
        var salt = makeRandom();
        var sqliteKeySalt = makeRandom();
        return hashPassword(salt, password).then((hash) => {
            return model.set(salt, sqliteKeySalt, hash);
        });
    },

    unlock(req, password) {
        var user = model.get();
        hashPassword(user.sqliteKeySalt, password).then((key) => {
            req.app.frontend.unlock(key);
        });
    },

    /* Middleware to check if the user is logged in before performing an
     * action. If not, the user will be redirected to login.
     */
    requireLogIn(req, res, next) {
        if (!model.isConfigured()) {
            if (req.method === 'GET' || req.method === 'HEAD') {
                req.session.redirect_to = req.originalUrl;
                res.redirect(Config.BASE_URL + '/user/configure');
            } else {
                res.status(401).render('configuration_required',
                                       { page_title: "Almond - Error" });
            }
        } else if (!req.user) {
            if (req.method === 'GET' || req.method === 'HEAD') {
                req.session.redirect_to = req.originalUrl;
                res.redirect(Config.BASE_URL + '/user/login');
            } else {
                res.status(401).render('login_required',
                                   { page_title: "Almond - Error" });
            }
        } else {
            next();
        }
    },
};
