// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
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

import * as Tp from 'thingpedia';
import * as qs from 'qs';
import express from 'express';
const router = express.Router();

import * as user from '../util/user';
import * as Config from '../config';

router.use(user.requireLogIn);

router.get('/', (req, res, next) => {
    res.render('devices_list', { page_title: 'Genie - My Skills',
                                 devices: req.app.genie.getDeviceInfos() });
});

router.get('/create', (req, res, next) => {
    if (req.query.class && ['online', 'physical', 'data'].indexOf(req.query.class as string) < 0) {
        res.status(404).render('error', { page_title: req._("Thingpedia - Error"),
                                          message: req._("Invalid device class") });
        return;
    }

    res.render('devices_create', { page_title: req._("Genie - Configure device"),
                                   klass: req.query.class,
                                   ownTier: 'cloud',
                                 });
});

router.post('/create', (req, res, next) => {
    const engine = req.app.genie;
    Promise.resolve().then(async () => {
        if (typeof req.body['kind'] !== 'string' ||
            req.body['kind'].length === 0) {
            res.status(400).render('error', { page_title: "Genie - Error",
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
    const engine = req.app.genie;
    Promise.resolve().then(async () => {
        const id = req.body.id;
        const removed = await engine.deleteDevice(id);

        if (!removed) {
            res.status(404).render('error', { page_title: "Genie - Error",
                                              message: "Not found." });
            return;
        }
        res.redirect(303, Config.BASE_URL + '/devices');
    }).catch(next);
});

router.get('/oauth2/:kind', (req, res, next) => {
    Promise.resolve().then(async () => {
        const kind = req.params.kind;

        const origin = req.app.genie.platform.getOrigin();
        let redirect;
        if (Config.IN_HOME_ASSISTANT_ADDON) {
            const info = JSON.parse(await Tp.Helpers.Http.get('http://supervisor/addons/self/info', {
                auth: 'Bearer ' + process.env.SUPERVISOR_TOKEN
            }));

            // redirect to the Home Assistant add-on page, with a crafted query string
            // the query string will be read by JS code inside the Genie page, which will perform
            // the actual redirect
            redirect = origin + '/hassio/ingress/' + info.data.slug + '?'
                + qs.stringify({ almond_redirect: Config.BASE_URL + '/devices/oauth2/callback/' + kind });
            const url = Config.CLOUD_SYNC_URL + `/proxy?` + qs.stringify({ redirect, kind });
            res.redirect(url);
        } else {
            // redirect directly to the add-on page
            // redirect = origin + Config.BASE_URL;
            const engine = req.app.genie;
            const result = await engine.startOAuth(kind);
            if (result !== null) {
                const redirect = result[0];
                const session = result[1];
                req.session.oauth2 = session;
                res.redirect(303, redirect);
            }
        }
    }).catch(next);
});

router.get('/oauth2/callback/:kind', (req, res, next) => {
    const kind = req.params.kind;
    const engine = req.app.genie;
    Promise.resolve().then(async () => {
        const session = (req.session.oauth2 || {}) as Record<string, string>;
        await engine.completeOAuth(kind, req.url, session);
        res.redirect(Config.BASE_URL + '/devices?class=online');
    }).catch((e) => {
        console.log(e.stack);
        res.status(400).render('error', { page_title: "Genie - Error",
                                          message: e.message });
    });
});


export default router;
