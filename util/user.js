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
const crypto = require('crypto');
const BaseStrategy = require('passport-strategy');

// a model of user based on sharedpreferences
const model = {
    isConfigured() {
        var prefs = platform.getSharedPreferences();
        var user = prefs.get('server-login');
        return user !== undefined;
    },

    get() {
        var prefs = platform.getSharedPreferences();
        var user = prefs.get('server-login');
        if (user === undefined)
            throw new Error("Login not configured yet");
        return user;
    },

    set(salt, sqliteKeySalt, passwordHash) {
        var prefs = platform.getSharedPreferences();
        var user = { password: passwordHash,
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
    }

    authenticate(req, options) {
        if (req.host === '127.0.0.1' && !req.isLocked && model.isConfigured())
            return this.success(model.get());
        else
            return this.pass();
    }
}

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

function makeRandom() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(salt, password) {
    return Q.nfcall(crypto.pbkdf2, password, salt, 10000, 32)
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

    passport.use(new LocalStrategy((username, password, done) => {
        Q.try(() => {
            try {
                var user = model.get();

                return hashPassword(user.salt, password).then((hash) => {
                    if (hash !== user.password)
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
        }).done();
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
        }).done();
    },

    /* Middleware to check if the user is logged in before performing an
     * action. If not, the user will be redirected to an error page.
     *
     * To be used for POST actions, where redirectLogin would not work.
     */
    requireLogIn(req, res, next) {
        if (!model.isConfigured()) {
            res.status(401).render('configuration_required',
                                   { page_title: "ThingEngine - Error" });
        } else if (!req.user) {
            res.status(401).render('login_required',
                                   { page_title: "ThingEngine - Error" });
        } else {
            next();
        }
    },

    /* Middleware to insert user log in page
     * After logging in, the user will be redirected to the original page
     */
    redirectLogIn(req, res, next) {
        if (!model.isConfigured()) {
            req.session.redirect_to = req.originalUrl;
            res.redirect('/user/configure');
        } if (!req.user) {
            req.session.redirect_to = req.originalUrl;
            res.redirect('/user/login');
        } else {
            next();
        }
    }
};
