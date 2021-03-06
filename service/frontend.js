// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2017-2019 The Board of Trustees of the Leland Stanford Junior University
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
"use strict";

const Q = require('q');
const events = require('events');
const http = require('http');

const express = require('express');
const path = require('path');
const logger = require('morgan');
//const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const csurf = require('csurf');
const errorHandler = require('errorhandler');
const expressWs = require('express-ws');
const passport = require('passport');
const connect_flash = require('connect-flash');

const user = require('../util/user');
const errorHandling = require('../util/error_handling');
const secretKey = require('../util/secret_key');

const Config = require('../config');

module.exports = class WebFrontend extends events.EventEmitter {
    constructor(platform) {
        super();

        this._platform = platform;

        // all environments
        this._app = express();
        this._app.frontend = this;
        this._server = http.createServer(this._app);
        expressWs(this._app, this._server);

        // work around a crash in expressWs if a WebSocket route fails with an error
        // code and express-session tries to save the session
        this._app.use((req, res, next) => {
            if (req.ws) {
                const originalWriteHead = res.writeHead;
                res.writeHead = function(statusCode) {
                    originalWriteHead.apply(this, arguments);
                    http.ServerResponse.prototype.writeHead.apply(this, arguments);
                };
            }

            next();
        });

        this._app.set('port', process.env.PORT || 3000);
        this._app.set('views', path.join(__dirname, '../views'));
        this._app.set('view engine', 'pug');
        if (Config.HAS_REVERSE_PROXY)
            this._app.set('trust proxy', true);
        //this._app.use(favicon());
        this._app.use(logger('dev'));
        this._app.use(bodyParser.json());
        this._app.use(bodyParser.urlencoded({ extended: true }));
        this._app.use(cookieParser());
        this._app.use(session({ resave: false,
                                saveUninitialized: false,
                                secret: secretKey.getSecretKey() }));
        this._app.use(connect_flash());
        this._app.use('/', express.static(path.join(__dirname, '../public')));

        // development only
        if ('development' === this._app.get('env')) {
            console.log('Frontend initialized in development mode');
            this._app.use(errorHandler());
        }

        this._app.use(passport.initialize());
        this._app.use(passport.session());
        this._isLocked = Config.ENABLE_DB_ENCRYPTION;
        this._app.use((req, res, next) => {
            req.isLocked = this._isLocked;
            res.locals.isLocked = this._isLocked;
            next();
        });
        if (Config.HOST_BASED_AUTHENTICATION !== 'disabled')
            this._app.use(passport.authenticate('host-based'));
        user.initializePassport();

        this._app.use((req, res, next) => {
            let port = ':' + this._app.get('port');
            let protocol = req.protocol;
            if (Config.HAS_REVERSE_PROXY) {
                if (req.headers['x-forwarded-port']) {
                    port = (':' + req.headers['x-forwarded-port']);
                } else if (req.headers['x-forwarded-host']) {
                    let tmp = req.headers['x-forwarded-host'].split(':');
                    port = tmp[1] ? (':' + tmp[1]) : '';
                } else {
                    port = '';
                }
                if (req.headers['x-forwarded-proto'])
                    protocol = req.headers['x-forwarded-proto'];
            }
            if ((protocol === 'http' && port === ':80') ||
                (protocol === 'https' && port === ':443'))
                port = '';
            this._platform._setOrigin(protocol + '://' + req.hostname + port);

            if (req.user) {
                res.locals.authenticated = true;
                res.locals.user = { username: req.user, isConfigured: true };
            } else {
                res.locals.authenticated = false;
                res.locals.user = { isConfigured: user.isConfigured() };
            }

            res.locals.Config = Config;
            res.locals.THINGPEDIA_URL = Config.THINGPEDIA_URL;
            res.locals.developerKey = (this._app.engine ? this._app.engine.platform.getSharedPreferences().get('developer-key') : '') || '';

            next();
        });

        // i18n support
        var gt = platform.getCapability('gettext');
        var modir = path.resolve(path.dirname(module.filename), '../po');
        try {
            gt.loadTextdomainDirectory('thingengine-platform-server', modir);
        } catch(e) {
            console.log('Failed to load translations: ' + e.message);
        }
        const gettext = gt.dgettext.bind(gt, 'thingengine-platform-server');
        const pgettext = gt.dpgettext.bind(gt, 'thingengine-platform-server');
        const ngettext = gt.dngettext.bind(gt, 'thingengine-platform-server');
        this._app.use((req, res, next) => {
            req.locale = platform.locale;
            req.gettext = gettext;
            req._ = req.gettext;
            req.pgettext = pgettext;
            req.ngettext = ngettext;

            res.locals.gettext = req.gettext;
            res.locals._ = req._;
            res.locals.pgettext = req.pgettext;
            res.locals.ngettext = req.ngettext;
            next();
        });

        // mount /api before csurf so we can perform requests without the CSRF token
        this._app.use('/api', require('../routes/api'));

        this._app.use(csurf({ cookie: false }));
        this._app.use((req, res, next) => {
            res.locals.csrfToken = req.csrfToken();
            next();
        });
        this._app.use('/', require('../routes/index'));
        this._app.use('/apps', require('../routes/apps'));
        this._app.use('/user', require('../routes/user'));
        this._app.use('/config', require('../routes/config'));
        this._app.use('/devices', require('../routes/devices'));
        this._app.use('/recording', require('../routes/recording'));

        this._app.use((req, res) => {
            // if we get here, we have a 404 response
            res.status(404).render('error', {
                page_title: req._("Almond - Page Not Found"),
                message: req._("The requested page does not exist.")
            });
        });
        this._app.use(errorHandling.html);
    }

    open() {
        // '::' means the same as 0.0.0.0 but for IPv6
        // without it, node.js will only listen on IPv4
        return Q.ninvoke(this._server, 'listen', this._app.get('port'), '::')
            .then(() => {
                console.log('Express server listening on port ' + this._app.get('port'));
            });
    }

    close() {
        return Q.ninvoke(this._server, 'close').then(() => {
            console.log('Express server stopped');
        }).catch((error) => {
            console.log('Error stopping Express server: ' + error);
            console.log(error.stack);
        });
    }

    getApp() {
        return this._app;
    }

    setEngine(engine) {
        this._app.engine = engine;
    }

    unlock(key) {
        if (!this._isLocked)
            return;
        this._isLocked = false;
        this.emit('unlock', key);
    }
};
