// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016-2019 The Board of Trustees of the Leland Stanford Junior University
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

const Q = require('q');
const express = require('express');
const passport = require('passport');

const user = require('../util/user');
const Config = require('../config');

var router = express.Router();

router.get('/configure', (req, res, next) => {
    if (user.isConfigured()) {
        res.status(400).render('error', {
            message: "User already configured",
            page_title: "Almond - Error"
        });
        return;
    }
    res.render('configure', {
        csrfToken: req.csrfToken(),
        page_title: "Almond - Setup",
        errors: []
    });
});

router.post('/configure', (req, res, next) => {
    if (user.isConfigured()) {
        res.status(400).render('error', {
            message: "User already configured",
            page_title: "Almond - Error"
        });
        return;
    }

    var password;
    try {
        if (typeof req.body['password'] !== 'string' ||
            req.body['password'].length < 8 ||
            req.body['password'].length > 255)
            throw new Error("You must specifiy a valid password (of at least 8 characters)");

        if (req.body['confirm-password'] !== req.body['password'])
            throw new Error("The password and the confirmation do not match");
        password = req.body['password'];

    } catch(e) {
        res.render('configure', {
            csrfToken: req.csrfToken(),
            page_title: "Almond - Setup",
            errors: [e.message]
        });
        return;
    }

    user.register(password).then((userObj) => {
        user.unlock(req, password);
        return Q.ninvoke(req, 'login', userObj);
    }).then(() => {
        // Redirection back to the original page
        var redirect_to = req.session.redirect_to || '/';
        delete req.session.redirect_to;
        res.redirect(redirect_to);
    }).catch((error) => {
        res.render('configure', {
            csrfToken: req.csrfToken(),
            page_title: "Almond - Setup",
            errors: [error.message]
        });
    });
});

router.get('/login', (req, res, next) => {
    res.render('login', {
        csrfToken: req.csrfToken(),
        errors: req.flash('error'),
        page_title: "Almond - Login"
    });
});


router.post('/login', passport.authenticate('local', { failureRedirect: Config.BASE_URL + '/user/login',
                                                       failureFlash: true }), (req, res, next) => {
    user.unlock(req, req.body.password);
    // Redirection back to the original page
    var redirect_to = req.session.redirect_to || (Config.BASE_URL + '/');
    delete req.session.redirect_to;
    res.redirect(redirect_to);
});

router.get('/logout', (req, res, next) => {
    req.logout();
    res.redirect(Config.BASE_URL + '/');
});


module.exports = router;
