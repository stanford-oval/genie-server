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
const Config = require('../config');

router.get('/', user.redirectLogIn, (req, res, next) => {
    res.render('devices_list', { page_title: 'Almond - My Goods',
                                 devices: req.app.engine.getDeviceInfos() });
});

router.get('/create', user.redirectLogIn, (req, res, next) => {
    if (req.query.class && ['online', 'physical', 'data'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: req._("Thingpedia - Error"),
                                          message: req._("Invalid device class") });
        return;
    }

    res.render('devices_create', { page_title: req._("Almond - Configure device"),
                                   klass: req.query.class,
                                   ownTier: 'cloud',
                                 });
});

router.post('/create', user.requireLogIn, (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        if (typeof req.body['kind'] !== 'string' ||
            req.body['kind'].length === 0)
            throw new Error("You must choose one kind of device");

        delete req.body['_csrf'];
        await engine.devices.addSerialized(req.body);
        if (req.session['device-redirect-to']) {
            res.redirect(303, req.session['device-redirect-to']);
            delete req.session['device-redirect-to'];
        } else {
            res.redirect(303, Config.BASE_URL + '/devices');
        }
    }).catch(next);
});

router.post('/delete', user.requireLogIn, (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        const id = req.body.id;
        const removed = await engine.deleteDevice(id);

        if (!removed) {
            res.status(404).render('error', { page_title: "Almond - Error",
                                              message: "Not found." });
            return;
        }
        res.redirect(Config.BASE_URL + '/devices');
    }).catch(next);
});

router.get('/oauth2/:kind', user.redirectLogIn, (req, res, next) => {
    const kind = req.params.kind;
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        const result = await engine.startOAuth(kind);
        if (result !== null) {
            const [redirect, session] = result;
            for (let key in session)
                req.session[key] = session[key];
            res.redirect(redirect);
        } else {
            res.redirect(Config.BASE_URL + '/devices?class=online');
        }
    }).catch(next);
});

router.get('/oauth2/callback/:kind', user.redirectLogIn, (req, res, next) => {
    const kind = req.params.kind;
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        await engine.completeOAuth(kind, req.url, req.session);
        res.redirect(Config.BASE_URL + '/devices?class=online');
    }).catch((e) => {
        console.log(e.stack);
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    });
});


module.exports = router;
