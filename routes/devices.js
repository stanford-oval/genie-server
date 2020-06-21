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

function getAllDevices(req, engine) {
    return engine.devices.getAllDevices().map((d) => {
        return { uniqueId: d.uniqueId, name: d.name || req._("Unknown device"),
                 description: d.description || req._("Description not available"),
                 kind: d.kind,
                 ownerTier: d.ownerTier,
                 available: d.available,
                 isTransient: d.isTransient,
                 isOnlineAccount: d.hasKind('online-account'),
                 isDataSource: d.hasKind('data-source'),
                 isPhysical: !d.hasKind('online-account') && !d.hasKind('data-source'),
                 isThingEngine: d.hasKind('thingengine-system') };
    }).filter((d) => !d.isThingEngine);
}

router.get('/', user.redirectLogIn, (req, res, next) => {
    res.render('devices_list', { page_title: 'Almond - My Goods',
                                 devices: getAllDevices(req, req.app.engine) });
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
    }).catch((e) => {
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    });
});

router.post('/delete', user.requireLogIn, (req, res, next) => {
    var engine = req.app.engine;
    var id = req.body.id;
    var device;
    try {
        if (!engine.devices.hasDevice(id))
            device = undefined;
        else
            device = engine.devices.getDevice(id);

        if (device === undefined) {
            res.status(404).render('error', { page_title: "Almond - Error",
                                              message: "Not found." });
            return;
        }

        engine.devices.removeDevice(device);
        res.redirect(Config.BASE_URL + '/devices');
    } catch(e) {
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    }
});

router.get('/oauth2/:kind', user.redirectLogIn, (req, res, next) => {
  const kind = req.params.kind;
  const redirect = req.protocol + '://' + req.hostname + ':' + req.app.get('port') + Config.BASE_URL + '/devices';
  const url = `https://thingengine.stanford.edu/proxy?redirect=${redirect}&kind=${kind}`;
  res.redirect(url);

});

router.get('/oauth2/callback/:kind', user.redirectLogIn, (req, res, next) => {
    const kind = req.params.kind;
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        await engine.devices.completeOAuth(kind, req.url, req.session);
        res.redirect(Config.BASE_URL + '/devices?class=online');
    }).catch((e) => {
        console.log(e.stack);
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    });
});


module.exports = router;
