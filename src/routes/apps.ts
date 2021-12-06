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


import express from 'express';
const router = express.Router();

import * as user from '../util/user';
import * as Config from '../config';

router.use(user.requireLogIn);

router.get('/', (req, res, next) => {
    const engine = req.app.genie;

    res.render('apps_list', { page_title: 'Genie - My Rules',
                              message: '',
                              csrfToken: req.csrfToken(),
                              apps: engine.getAppInfos() });
});

router.post('/delete', (req, res, next) => {
    Promise.resolve().then(async () => {
        const engine = req.app.genie;

        const id = req.body.id;
        const deleted = await engine.deleteApp(id);
        if (!deleted) {
            res.status(404).render('error', { page_title: "Genie - Error",
                                              message: "Not found." });
            return;
        }

        req.flash('app-message', "Rule successfully stopped");
        res.redirect(303, Config.BASE_URL + '/apps');
    }).catch(next);
});

export default router;
