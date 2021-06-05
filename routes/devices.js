// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016-2020 The Board of Trustees of the Leland Stanford Junior University
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
"use strict";

const express = require('express');
const Tp = require('thingpedia');
const qs = require('qs');

var router = express.Router();

const user = require('../util/user');
const Config = require('../config');

router.use(user.requireLogIn);

router.get('/', (req, res, next) => {
    res.render('devices_list', { page_title: 'Almond - My Skills',
                                 devices: req.app.engine.getDeviceInfos() });
});

router.get('/create', (req, res, next) => {
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

router.post('/create', (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        if (typeof req.body['kind'] !== 'string' ||
            req.body['kind'].length === 0) {
            res.status(400).render('error', { page_title: "Almond - Error",
                                              message: "Missing or invalid parameter kind" });
            return;
        }

        delete req.body['_csrf'];
        try {
            await engine.devices.addSerialized(req.body);
        } catch(e) {
            e.status = 400;
            throw e;
        }
        if (req.session['device-redirect-to']) {
            res.redirect(303, req.session['device-redirect-to']);
            delete req.session['device-redirect-to'];
        } else {
            res.redirect(303, Config.BASE_URL + '/devices');
        }
    }).catch(next);
});

router.post('/delete', (req, res, next) => {
    const engine = req.app.engine;
    Promise.resolve().then(async () => {
        const id = req.body.id;
        const removed = await engine.deleteDevice(id);

        if (!removed) {
            res.status(404).render('error', { page_title: "Almond - Error",
                                              message: "Not found." });
            return;
        }
        res.redirect(303, Config.BASE_URL + '/devices');
    }).catch(next);
});

router.get('/oauth2/:kind', (req, res, next) => {
    Promise.resolve().then(async () => {
        const kind = req.params.kind;

        const origin = req.app.engine.platform.getOrigin();
        let redirect;
        if (Config.IN_HOME_ASSISTANT_ADDON) {
            const info = JSON.parse(await Tp.Helpers.Http.get('http://supervisor/addons/self/info', {
                auth: 'Bearer ' + process.env.SUPERVISOR_TOKEN
            }));

            // redirect to the Home Assistant add-on page, with a crafted query string
            // the query string will be read by JS code inside the Almond page, which will perform
            // the actual redirect
            redirect = origin + '/hassio/ingress/' + info.data.slug + '?'
                + qs.stringify({ almond_redirect: Config.BASE_URL + '/devices/oauth2/callback/' + kind });
        } else {
            // redirect directly to the add-on page
            redirect = encodeURIComponent(origin + Config.BASE_URL);
        }

        const url = Config.CLOUD_SYNC_URL + `/proxy?` + qs.stringify({ redirect, kind });
        res.redirect(url);
    }).catch(next);
});

router.get('/oauth2/callback/:kind', (req, res, next) => {
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
