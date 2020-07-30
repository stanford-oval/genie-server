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
var router = express.Router();

const user = require('../util/user');
const Config = require('../config');

router.get('/', user.redirectLogIn, (req, res, next) => {
    const engine = req.app.engine;

    res.render('apps_list', { page_title: 'Almond - My Rules',
                              message: '',
                              csrfToken: req.csrfToken(),
                              apps: engine.getAppInfos() });
});

router.post('/delete', user.requireLogIn, (req, res, next) => {
    Promise.resolve(async () => {
        const engine = req.app.engine;

        const id = req.body.id;
        const deleted = await engine.deleteApp(id);
        if (!deleted) {
            res.status(404).render('error', { page_title: "Almond - Error",
                                              message: "Not found." });
            return;
        }

        req.flash('app-message', "Rule successfully stopped");
        res.redirect(303, Config.BASE_URL + '/apps');
    }).catch(next);
});

module.exports = router;
