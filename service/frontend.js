
/**
 * Module dependencies.
 */
"use strict";

const Q = require('q');
const events = require('events');

const express = require('express');
const path = require('path');
const logger = require('morgan');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const csurf = require('csurf');
const errorHandler = require('errorhandler');
const expressWs = require('express-ws');
const passport = require('passport');
const connect_flash = require('connect-flash');

const user = require('../util/user');
const secretKey = require('../util/secret_key');

const Config = require('../config');

module.exports = class WebFrontend extends events.EventEmitter {
    constructor(platform) {
        super();

        this._platform = platform;

        // all environments
        this._app = express();
        this._app.frontend = this;

        this._app.set('port', process.env.PORT || 3000);
        this._app.set('views', path.join(__dirname, '../views'));
        this._app.set('view engine', 'pug');
        //this._app.use(favicon());
        this._app.use(logger('dev'));
        this._app.use(bodyParser.json());
        this._app.use(bodyParser.urlencoded({ extended: true }));
        this._app.use(cookieParser());
        this._app.use(session({ resave: false,
                                saveUninitialized: false,
                                secret: secretKey.getSecretKey() }));
        this._app.use(csurf({ cookie: false,
                              ignoreMethods: ['GET','HEAD','OPTIONS',
                                              'UPGRADE','CONNECT']
                            }));
        this._app.use(connect_flash());
        this._app.use(express.static(path.join(__dirname, '../public')));
        expressWs(this._app);

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
        this._app.use(passport.authenticate('host-based'));
        user.initializePassport();

        this._app.use((req, res, next) => {
            this._platform._setOrigin(req.protocol + '://' + req.hostname + ':' + this._app.get('port'));
            if (req.user) {
                res.locals.authenticated = true;
                res.locals.user = { username: req.user, isConfigured: true };
            } else {
                res.locals.authenticated = false;
                res.locals.user = { isConfigured: user.isConfigured() };
            }

            res.locals.THINGPEDIA_URL = Config.THINGPEDIA_URL;

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
        const gettext = gt.dgettext.bind(gt, 'thingengine-platform-server');;
        const pgettext = gt.dpgettext.bind(gt, 'thingengine-platform-server');
        const ngettext = gt.dngettext.bind(gt, 'thingengine-platform-server');
        this._app.use(function(req, res, next) {
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

        this._app.use('/', require('../routes/index'));
        this._app.use('/apps', require('../routes/apps'));
        this._app.use('/user', require('../routes/user'));
        this._app.use('/config', require('../routes/config'));
        this._app.use('/devices', require('../routes/devices'));
        this._app.use('/conversation', require('../routes/conversation'));
        this._app.use('/api', require('../routes/api'));
    }

    open() {
        // '::' means the same as 0.0.0.0 but for IPv6
        // without it, node.js will only listen on IPv4
        return Q.ninvoke(this._app, 'listen', this._app.get('port'), '::')
            .then(function() {
                console.log('Express server listening on port ' + this._app.get('port'));
            }.bind(this));
    }

    close() {
        return Q.ninvoke(this._server, 'close').then(function() {
            console.log('Express server stopped');
        }).catch(function(error) {
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
}
