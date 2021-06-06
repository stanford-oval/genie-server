// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
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

import express from 'express';
import * as crypto from 'crypto';
import * as util from 'util';

import passport from 'passport';
import { Strategy as BaseStrategy } from 'passport-strategy';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as BearerStrategy } from 'passport-http-bearer';

import platform from '../service/platform';
import { makeRandom } from './random';

import * as Config from '../config';

declare global {
    namespace Express {
        interface User {
            password : string;
            salt : string;
            sqliteKeySalt : string;
        }
    }
}

// a model of user based on sharedpreferences
const model = {
    isConfigured() {
        const prefs = platform.getSharedPreferences();
        const user = prefs.get('server-login');
        return user !== undefined;
    },

    get() {
        const prefs = platform.getSharedPreferences();
        const user = prefs.get('server-login') as Express.User|undefined;
        if (user === undefined)
            throw new Error("Login not configured yet");
        return user;
    },

    set(salt : string, sqliteKeySalt : string, passwordHash : string) {
        const prefs = platform.getSharedPreferences();
        const user : Express.User = {
            password: passwordHash,
            salt: salt,
            sqliteKeySalt: sqliteKeySalt
        };
        prefs.set('server-login', user);
        return user;
    }
};

class HostBasedStrategy extends BaseStrategy {
    name : string;
    private _mode : string;

    constructor() {
        super();
        this.name = 'host-based';

        this._mode = Config.HOST_BASED_AUTHENTICATION;
        if (['disabled', 'local-ip', 'proxied-ip', 'insecure'].indexOf(this._mode) < 0)
            throw new Error(`Configuration error: invalid value ${this._mode} for HOST_BASED_AUTHENTICATION setting`);
    }

    authenticate(req : express.Request) {
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

function hashPassword(salt : string, password : string) {
    return util.promisify(crypto.pbkdf2)(password, salt, 10000, 32, 'sha1')
        .then((buffer) => buffer.toString('hex'));
}

export function initializePassport() {
    passport.serializeUser((user, done) => {
        done(null, 'local');
    });

    passport.deserializeUser<'local'>((user, done) => {
        done(null, user === 'local' ? model.get() : undefined);
    });

    passport.use(new HostBasedStrategy());

    passport.use(new BearerStrategy((accessToken, done) => {
        Promise.resolve().then(async () : Promise<[Express.User|false, string|null]> => {
            try {
                const prefs = platform.getSharedPreferences();
                const expectedAccessToken = prefs.get('access-token') as string;
                if (!expectedAccessToken)
                    return [false, "Access token not configured"];
                if (crypto.timingSafeEqual(new Buffer(accessToken, 'hex'), new Buffer(expectedAccessToken, 'hex')))
                    return [model.get(), null];
                return [false, "Invalid access token"];
            } catch(e) {
                return [false, e.message];
            }
        }).then((result) => {
            done(null, result[0], { message: result[1]!, scope: [] });
        }, (err) => {
            done(err);
        });
    }));

    passport.use(new LocalStrategy((username, password, done) => {
        Promise.resolve().then(async () : Promise<[Express.User|false, string|null]> => {
            try {
                const user = model.get();

                return hashPassword(user.salt, password).then((hash) => {
                    if (!crypto.timingSafeEqual(new Buffer(hash, 'hex'), new Buffer(user.password, 'hex')))
                        return [false, "Invalid username or password"];

                    return [user, null];
                });
            } catch(e) {
                return [false, e.message];
            }
        }).then((result) => {
            done(null, result[0], { message: result[1]! });
        }, (err) => {
            done(err);
        });
    }));
}

export function isConfigured() {
    return model.isConfigured();
}

export function register(password : string) {
    const salt = makeRandom();
    const sqliteKeySalt = makeRandom();
    return hashPassword(salt, password).then((hash) => {
        return model.set(salt, sqliteKeySalt, hash);
    });
}

export function unlock(req : express.Request, password : string) {
    const user = model.get();
    hashPassword(user.sqliteKeySalt, password).then((key) => {
        req.app.frontend.unlock(key);
    });
}

/* Middleware to check if the user is logged in before performing an
    * action. If not, the user will be redirected to login.
    */
export function requireLogIn(req : express.Request, res : express.Response, next : express.NextFunction) {
    if (!model.isConfigured()) {
        if (req.method === 'GET' || req.method === 'HEAD') {
            if (!req.originalUrl.startsWith('/api') &&
                !req.originalUrl.startsWith('/recording') &&
                !req.originalUrl.startsWith('/ws'))
                req.session.redirect_to = req.originalUrl;
            res.redirect(Config.BASE_URL + '/user/configure');
        } else {
            res.status(401).render('error', {
                page_title: "Almond - Error",
                message: "You must complete the initial configuration of your Almond before you can perform this action."
            });
        }
    } else if (!req.user) {
        if (req.method === 'GET' || req.method === 'HEAD') {
            if (!req.originalUrl.startsWith('/api') &&
                !req.originalUrl.startsWith('/recording') &&
                !req.originalUrl.startsWith('/ws'))
                req.session.redirect_to = req.originalUrl;
            res.redirect(Config.BASE_URL + '/user/login');
        } else {
            res.status(401).render('login_required', { page_title: "Almond - Error" });
        }
    } else {
        next();
    }
}
