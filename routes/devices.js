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
    }).filter(d => !d.isThingEngine);
}

router.get('/', user.redirectLogIn, function(req, res, next) {
    res.render('devices_list', { page_title: 'Almond - My Goods',
                                 csrfToken: req.csrfToken(),
                                 devices: getAllDevices(req, req.app.engine) });
});

router.get('/create', user.redirectLogIn, function(req, res, next) {
    if (req.query.class && ['online', 'physical', 'data'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: req._("Thingpedia - Error"),
                                          message: req._("Invalid device class") });
        return;
    }

    res.render('devices_create', { page_title: req._("Almond - Configure device"),
                                   csrfToken: req.csrfToken(),
                                   developerKey: req.user.developer_key,
                                   klass: req.query.class,
                                   ownTier: 'cloud',
                                 });
});

router.post('/create', user.requireLogIn, function(req, res, next) {
    var engine = req.app.engine;
    var devices = engine.devices;

    Q.try(() => {
        if (typeof req.body['kind'] !== 'string' ||
            req.body['kind'].length == 0)
            throw new Error("You must choose one kind of device");

        delete req.body['_csrf'];
        return devices.loadOneDevice(req.body, true);
    }).then(() => {
        if (req.session['device-redirect-to']) {
            res.redirect(303, req.session['device-redirect-to']);
            delete req.session['device-redirect-to'];
        } else {
            res.redirect(303, '/me');
        }
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    }).done();
});

router.post('/delete', user.requireLogIn, function(req, res, next) {
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
        res.redirect('/devices');
    } catch(e) {
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    }
});

router.get('/oauth2/:kind', user.redirectLogIn, function(req, res, next) {
    var kind = req.params.kind;

    var engine = req.app.engine;
    var devFactory = engine.devices.factory;

    Q.try(function() {
        return Q(devFactory.runOAuth2(kind, null));
    }).then(function(result) {
        if (result !== null) {
            var redirect = result[0];
            var session = result[1];
            for (var key in session)
                req.session[key] = session[key];
            res.redirect(redirect);
        } else {
            res.redirect('/devices?class=online');
        }
    }).catch(function(e) {
        console.log(e.stack);
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    }).done();
});

router.get('/oauth2/callback/:kind', user.redirectLogIn, function(req, res, next) {
    var kind = req.params.kind;

    var engine = req.app.engine;
    var devFactory = engine.devices.factory;

    Q.try(function() {
        return Q(devFactory.runOAuth2(kind, req));
    }).then(function() {
        res.redirect('/devices?class=online');
    }).catch(function(e) {
        console.log(e.stack);
        res.status(400).render('error', { page_title: "Almond - Error",
                                          message: e.message });
    }).done();
});


module.exports = router;
