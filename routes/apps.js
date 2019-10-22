// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const express = require('express');
var router = express.Router();

const user = require('../util/user');

function appsList(req, res, next, message) {
    var engine = req.app.engine;

    var apps = engine.apps.getAllApps();
    var info = apps.map((a) => {
        return { uniqueId: a.uniqueId, name: a.name || "Some app", description: a.description,
                 running: a.isRunning, enabled: a.isEnabled,
                 currentTier: a.currentTier };
    });

    res.render('apps_list', { page_title: 'Almond - My Rules',
                              message: message,
                              csrfToken: req.csrfToken(),
                              apps: info });
}

router.get('/', user.redirectLogIn, (req, res, next) => {
    appsList(req, res, next, '');
});

router.post('/delete', user.requireLogIn, (req, res, next) => {
    try {
        var engine = req.app.engine;

        var id = req.body.id;
        var app = engine.apps.getApp(id);
        if (app === undefined) {
            res.status(404).render('error', { page_title: "Almond - Error",
                                              message: "Not found." });
            return;
        }

        engine.apps.removeApp(app).then(() => {
            req.flash('app-message', "Rule successfully stopped");
            res.redirect(303, '/apps');
        }).catch((e) => {
            res.status(400).render('error', { page_title: "Almond - Error",
                                              message: e.message + '\n' + e.stack });
        }).catch(next);
    } catch(e) {
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message + '\n' + e.stack });
        
    }
});

module.exports = router;
