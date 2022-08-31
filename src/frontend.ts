// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
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

import Q from 'q';
import * as events from 'events';
import * as http from 'http';
import * as Genie from 'genie-toolkit';

import express from 'express';
import * as path from 'path';
import logger from 'morgan';
//const favicon = require('serve-favicon');
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import session from 'express-session';
import csurf from 'csurf';
import errorHandler from 'errorhandler';
import expressWs from 'express-ws';
import passport from 'passport';
import connect_flash from 'connect-flash';

import * as user from './util/user';
import * as errorHandling from './util/error_handling';
import * as secretKey from './util/secret_key';
import type { ServerPlatform } from './service/platform';
import * as I18n from './util/i18n';

import * as Config from './config';

declare global {
    namespace Express {
        interface Application {
            frontend : WebFrontend;
            //engine : Genie.AssistantEngine;
            genie : Genie.AssistantEngine;
        }

        interface Request {
            isLocked : boolean;
            locale : string;

            _ : (x : string) => string;
            gettext : (x : string) => string;
            ngettext : (x : string, x1 : string, n : number) => string;
            pgettext : (c : string, x : string) => string;
        }


    }
}

declare module 'express-session' {
    interface SessionData {
        'device-redirect-to' : string;
        redirect_to : string;
        oauth2: Record<string, string>;
    }
}

export default class WebFrontend extends events.EventEmitter {
    private _platform : ServerPlatform;
    private _app : express.Application;
    private _server : http.Server;
    private _isLocked = true;

    constructor(platform : ServerPlatform) {
        super();

        this._platform = platform;
        this._app = express();
        this._app.frontend = this;
        this._server = http.createServer(this._app);
    }

    async init() {
        // all environments
        expressWs(this._app, this._server);

        // work around a crash in expressWs if a WebSocket route fails with an error
        // code and express-session tries to save the session
        this._app.use((req, res, next) => {
            if ((req as any).ws) {
                const originalWriteHead = res.writeHead as any;
                res.writeHead = function(statusCode : number) : any {
                    // eslint-disable-next-line prefer-rest-params
                    originalWriteHead.apply(this, arguments);
                    // eslint-disable-next-line prefer-rest-params
                    return (http.ServerResponse.prototype.writeHead as any).apply(this, arguments);
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
            if (Config.HAS_REVERSE_PROXY) {
                if (req.headers['x-forwarded-port']) {
                    port = (':' + req.headers['x-forwarded-port']);
                } else if (req.headers['x-forwarded-host']) {
                    const tmp = String(req.headers['x-forwarded-host']).split(':');
                    port = tmp[1] ? (':' + tmp[1]) : '';
                } else {
                    port = '';
                }
            }
            if ((req.protocol === 'http' && port === ':80') ||
                (req.protocol === 'https' && port === ':443'))
                port = '';
            this._platform._setOrigin(req.protocol + '://' + req.hostname + port);

            if (req.user) {
                res.locals.authenticated = true;
                res.locals.user = { username: req.user, isConfigured: true };
            } else {
                res.locals.authenticated = false;
                res.locals.user = { isConfigured: user.isConfigured() };
            }

            res.locals.Config = Config;
            res.locals.THINGPEDIA_URL = Config.THINGPEDIA_URL;
            res.locals.developerKey = (this._app.engine ?
                (this._app.engine as unknown as Genie.AssistantEngine).platform.getSharedPreferences().get('developer-key') : '') || '';

            next();
        });

        // i18n support
        const gt = this._platform.getCapability('gettext');
        const modir = path.resolve(path.dirname(module.filename), '../po');
        try {
            I18n.loadTextdomainDirectory(gt, this._platform.locale, 'almond-server', modir);
        } catch(e) {
            console.log('Failed to load translations: ' + e.message);
        }
        const gettext = gt.dgettext.bind(gt, 'almond-server');
        const pgettext = gt.dpgettext.bind(gt, 'almond-server');
        const ngettext = gt.dngettext.bind(gt, 'almond-server');
        this._app.use((req, res, next) => {
            req.locale = this._platform.locale;
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
        this._app.use('/api', (await import('./routes/api')).default);

        this._app.use(csurf({ cookie: false }));
        this._app.use((req, res, next) => {
            res.locals.csrfToken = req.csrfToken();
            next();
        });
        this._app.use('/', (await import('./routes/index')).default);
        this._app.use('/apps', (await import('./routes/apps')).default);
        this._app.use('/user', (await import('./routes/user')).default);
        this._app.use('/config', (await import('./routes/config')).default);
        this._app.use('/devices', (await import('./routes/devices')).default);
        this._app.use('/recording', (await import('./routes/recording')).default);

        this._app.use((req, res) => {
            // if we get here, we have a 404 response
            res.status(404).render('error', {
                page_title: req._("Genie - Page Not Found"),
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

    setEngine(engine : Genie.AssistantEngine) {
        this._app.genie = engine;

        // FIXME this code is broken because we're overwriting a method in express!
        (this._app as any).engine = engine;
    }

    unlock(key : string) {
        if (!this._isLocked)
            return;
        this._isLocked = false;
        this.emit('unlock', key);
    }
}
