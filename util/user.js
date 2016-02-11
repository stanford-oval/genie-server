// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const crypto = require('crypto');

// a model of user based on sharedpreferences
const model = {
    isConfigured: function() {
        var prefs = platform.getSharedPreferences();
        var user = prefs.get('server-login');
        return user !== undefined;
    },

    get: function() {
        var prefs = platform.getSharedPreferences();
        var user = prefs.get('server-login');
        if (user === undefined)
            throw new Error("Login not configured yet");
        return user;
    },

    set: function(username, salt, passwordHash) {
        var prefs = platform.getSharedPreferences();
        var user = { username: username,
                     password: passwordHash,
                     salt: salt };
        prefs.set('server-login', user);
    }
};

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

function makeRandom() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(salt, password) {
    return Q.nfcall(crypto.pbkdf2, password, salt, 10000, 32)
        .then(function(buffer) {
            return buffer.toString('hex');
        });
}

function initializePassport() {
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    passport.use(new LocalStrategy(function(username, password, done) {
        Q.try(function() {
            try {
                var user = model.get();

                return hashPassword(user.salt, password)
                    .then(function(hash) {
                        if (hash !== user.password)
                            return [false, "Invalid username or password"];

            	        return [user.username, null];
		    });
            } catch(e) {
                return [false, e.message];
            }
        }).then(function(result) {
            done(null, result[0], { message: result[1] });
        }, function(err) {
            done(err);
        }).done();
    }));
}

module.exports = {
    initializePassport: initializePassport,

    isConfigured: function() {
        return model.isConfigured();
    },

    register: function(username, password) {
        var salt = makeRandom();
        return hashPassword(salt, password)
            .then(function(hash) {
                model.set(username, salt, hash);
                return username;
            });
    },

    /* Middleware to check if the user is logged in before performing an
     * action. If not, the user will be redirected to an error page.
     *
     * To be used for POST actions, where redirectLogin would not work.
     */
    requireLogIn: function(req, res, next) {
        if (model.isConfigured() && !req.user) {
            res.status(401).render('login_required',
                                   { page_title: "ThingEngine - Error" });
        } else {
            next();
        }
    },

    /* Middleware to insert user log in page
     * After logging in, the user will be redirected to the original page
     */
    redirectLogIn: function(req, res, next) {
        if (model.isConfigured() && !req.user) {
            req.session.redirect_to = req.originalUrl;
            res.redirect('/user/login');
        } else {
            next();
        };
    }
};
