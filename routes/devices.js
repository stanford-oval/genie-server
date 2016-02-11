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

router.get('/', user.redirectLogIn, function(req, res, next) {
    if (req.query.class && ['online', 'physical'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Invalid device class" });
        return;
    }

    var online = req.query.class === 'online';

    var engine = req.app.engine;

    var devices = engine.devices.getAllDevices().filter(function(d) {
        if (d.hasKind('thingengine-system'))
            return false;

        if (online)
            return d.hasKind('online-account');
        else
            return !d.hasKind('online-account');
    });
    Q.all(devices.map(function(d) {
        return Q(d.checkAvailable()).then(function(avail) {
            return { uniqueId: d.uniqueId, name: d.name || "Unknown device",
                     description: d.description || "Description not available",
                     ownerTier: d.ownerTier,
                     available: avail };
        });
    })).then(function(info) {
        res.render('devices_list', { page_title: 'ThingEngine - configured devices',
                                     csrfToken: req.csrfToken(),
                                     onlineAccounts: online,
                                     devices: info });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

router.get('/create', user.redirectLogIn, function(req, res, next) {
    if (req.query.class && ['online', 'physical'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Invalid device class" });
        return;
    }

    var online = req.query.class === 'online';

    res.render('devices_create', { page_title: 'ThingEngine - configure device',
                                   csrfToken: req.csrfToken(),
                                   onlineAccounts: online,
                                 });
});

router.post('/create', user.requireLogIn, function(req, res, next) {
    if (req.query.class && ['online', 'physical'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Invalid device class" });
        return;
    }

    var engine = req.app.engine;
    var devices = engine.devices;

    try {
        if (typeof req.body['kind'] !== 'string' ||
            req.body['kind'].length == 0)
            throw new Error("You must choose one kind of device");

        delete req.body['_csrf'];

        devices.loadOneDevice(req.body, true).then(function() {
            res.redirect('/devices?class=' + (req.query.class || 'physical'));
        }).catch(function(e) {
            res.status(400).render('error', { page_title: "ThingEngine - Error",
                                              message: e.message });
        }).done();
    } catch(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }
});

router.post('/delete', user.requireLogIn, function(req, res, next) {
    if (req.query.class && ['online', 'physical'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Invalid device class" });
        return;
    }

    var engine = req.app.engine;
    var id = req.body.id;
    var device;
    try {
        if (!engine.devices.hasDevice(id))
            device = undefined;
        else
            device = engine.devices.getDevice(id);

        if (device === undefined) {
            res.status(404).render('error', { page_title: "ThingEngine - Error",
                                              message: "Not found." });
            return;
        }

        engine.devices.removeDevice(device);
        res.redirect('/devices?class=' + (req.query.class || 'physical'));
    } catch(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
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
        res.status(400).render('error', { page_title: "ThingEngine - Error",
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
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});


module.exports = router;
