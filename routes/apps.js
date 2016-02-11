// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');
var router = express.Router();

const user = require('../util/user');
const feeds = require('../../shared/util/feeds');

const ThingTalk = require('thingtalk');
const AppCompiler = ThingTalk.Compiler;

function appsList(req, res, next, message) {
    var engine = req.app.engine;

    var apps = engine.apps.getAllApps();
    var info = apps.map(function(a) {
        return { uniqueId: a.uniqueId, name: a.name || "Some app",
                 running: a.isRunning, enabled: a.isEnabled,
                 currentTier: a.currentTier };
    });

    res.render('apps_list', { page_title: 'ThingEngine - installed apps',
                              message: message,
                              csrfToken: req.csrfToken(),
                              apps: info });
}

router.get('/', user.redirectLogIn, function(req, res, next) {
    appsList(req, res, next, '');
});

function appsCreate(error, req, res) {
    return feeds.getFeedList(req.app.engine, false).then(function(feeds) {
        res.render('apps_create', { page_title: 'ThingEngine - create app',
                                    csrfToken: req.csrfToken(),
                                    error: error,
                                    code: req.body.code,
                                    parameters: req.body.params || '{}',
                                    tier: req.body.tier || 'server',
                                    omlet: { feeds: feeds,
                                             feedId: req.body.feedId }
                                  });
    });
}

router.get('/create', user.redirectLogIn, function(req, res, next) {
    appsCreate(undefined, req, res).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.post('/create', user.requireLogIn, function(req, res, next) {
    Q.try(function() {
        var engine = req.app.engine;
        var code = req.body.code;
        var state, tier;
        return Q.try(function() {
            // sanity check the app
            var compiler = new AppCompiler();
            compiler.setSchemaRetriever(engine.devices.schemas);
            return compiler.compileCode(code).then(function() {
                state = JSON.parse(req.body.params);
                if (compiler.feedAccess) {
                    if (!state.$F && !req.body.feedId)
                        throw new Error('Missing feed for feed-shared app');
                    if (!state.$F)
                        state.$F = req.body.feedId;
                } else {
                    delete state.$F;
                }

                tier = req.body.tier;
                if (tier !== 'server' && tier !== 'cloud' && tier !== 'phone')
                    throw new Error('No such tier ' + tier);
            });
        }).then(function() {
            return engine.apps.loadOneApp(code, state, undefined, tier, true).then(function() {
                appsList(req, res, next, "Application successfully created");
            });
        }).catch(function(e) {
            return appsCreate(e.message, req, res);
        });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.post('/delete', user.requireLogIn, function(req, res, next) {
    try {
        var engine = req.app.engine;

        var id = req.body.id;
        var app = engine.apps.getApp(id);
        if (app === undefined) {
            res.status(404).render('error', { page_title: "ThingEngine - Error",
                                              message: "Not found." });
            return;
        }

        engine.apps.removeApp(app).then(function() {
            appsList(req, res, next, "Application successfully deleted");
        }).catch(function(e) {
            res.status(400).render('error', { page_title: "ThingEngine - Error",
                                              message: e.message + '\n' + e.stack });
        }).done();
    } catch(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message + '\n' + e.stack });
        return;
    }
});

router.get('/:id/show', user.redirectLogIn, function(req, res, next) {
    var engine = req.app.engine;

    var app = engine.apps.getApp(req.params.id);
    if (app === undefined) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Not found." });
        return;
    }

    return res.render('show_app', { page_title: "ThingEngine App",
                                    name: app.name,
                                    description: app.description || '',
                                    csrfToken: req.csrfToken(),
                                    code: app.code,
                                    params: JSON.stringify(app.state) });
});

router.post('/:id/update', user.requireLogIn, function(req, res, next) {
    var engine = req.app.engine;

    var app = engine.apps.getApp(req.params.id);
    if (app === undefined) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Not found." });
        return;
    }

    // do something
    Q.try(function() {
        var code = req.body.code;
        var state;
        return Q.try(function() {
            // sanity check the app
            var compiler = new AppCompiler();
            compiler.setSchemaRetriever(engine.devices.schemas);
            return compiler.compileCode(code).then(function() {
                state = JSON.parse(req.body.params);
            });
        }).then(function() {
            return engine.apps.loadOneApp(code, state, req.params.id, app.currentTier, true).then(function() {
                appsList(req, res, next, "Application successfully updated");
            });
        }).catch(function(e) {
            res.render('show_app', { page_title: 'ThingEngine App',
                                     name: app.name,
                                     description: app.description || '',
                                     csrfToken: req.csrfToken(),
                                     error: e.message,
                                     code: code,
                                     params: req.body.params });
            return;
        });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

module.exports = router;
