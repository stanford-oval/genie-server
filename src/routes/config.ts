// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
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

import Q from 'q';
import express from 'express';
import * as Genie from 'genie-toolkit';

import * as user from '../util/user';
import platform from '../service/platform';

import * as Config from '../config';

const router = express.Router();

router.use(user.requireLogIn);

function config(req : express.Request, res : express.Response, next : express.NextFunction,
                userData : { username ?: string, password ?: string, error ?: unknown },
                cloudData : { username ?: string, error ?: unknown }) {
    return Genie.IpAddressUtils.getServerName().then((host) => {
        const port = res.app.get('port');
        const serverAddress = 'http://' +
            (host.indexOf(':') >= 0 ? '[' + host + ']' : host)
            + ':' + port + Config.BASE_URL + '/config';

        const prefs = platform.getSharedPreferences();
        const cloudId = prefs.get('cloud-id');
        const authToken = prefs.get('auth-token');

        const qrcodeTarget = 'https://thingengine.stanford.edu/qrcode/' + host + '/'
            + port + '/' + authToken;

        const ipAddresses = Genie.IpAddressUtils.getServerAddresses(host);
        res.render('config', {
            page_title: "Configure Almond",
            csrfToken: req.csrfToken(),
            server: {
                name: host, port: port,
                address: serverAddress,
                extraAddresses: ipAddresses,
                initialSetup: authToken === undefined
            },
            user: {
                isConfigured: user.isConfigured(),
                username: userData.username || req.user,
                password: userData.password,
                error: userData.error
            },
            cloud: {
                isConfigured: cloudId !== undefined,
                error: cloudData.error,
                username: cloudData.username,
                id: cloudId
            },
            settings: {
                data_collection: prefs.get('sabrina-store-log') === 'yes',
                voice_input: prefs.get('enable-voice-input') === undefined ? true : prefs.get('enable-voice-input'),
                voice_output: prefs.get('enable-voice-output') === undefined ? true : prefs.get('enable-voice-output'),
            },
            qrcodeTarget: qrcodeTarget
        });
    });
}

router.get('/', (req, res, next) => {
    config(req, res, next, {}, {}).catch(next);
});

router.post('/set-options', (req, res, next) => {
    const prefs = platform.getSharedPreferences();
    prefs.set('sabrina-store-log', req.body.data_collection ? 'yes' : 'no');
    prefs.set('enable-voice-input', !!req.body.voice_input);
    prefs.set('enable-voice-output', !!req.body.voice_output);
    res.redirect(303, Config.BASE_URL + '/config');
});

router.post('/set-server-password', (req, res, next) => {
    let password : string;
    try {
        if (typeof req.body['password'] !== 'string' ||
            req.body['password'].length < 8 ||
            req.body['password'].length > 255)
            throw new Error("You must specify a valid password (of at least 8 characters)");

        if (req.body['confirm-password'] !== req.body['password'])
            throw new Error("The password and the confirmation do not match");
        password = req.body['password'];

    } catch(e) {
        config(req, res, next, { password: '',
                                 error: e.message }, {}).catch(next);
        return;
    }

    user.register(password).then((userObj) => {
        user.unlock(req, password);
        return Q.ninvoke(req, 'login', userObj);
    }).then(() => {
        res.redirect(Config.BASE_URL + '/config');
    }).catch((error) => {
        return config(req, res, next, { password: '',
                                        error: error.message }, {});
    }).catch(next);
});

export default router;
