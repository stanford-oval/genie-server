// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');
const passport = require('passport');

const user = require('../util/user');

var router = express.Router();

router.get('/configure', function(req, res, next) {
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

router.post('/configure', function(req, res, next) {
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

    user.register(password).then(function(userObj) {
        user.unlock(req, password);
        return Q.ninvoke(req, 'login', userObj);
    }).then(function() {
        // Redirection back to the original page
        var redirect_to = req.session.redirect_to || '/';
        delete req.session.redirect_to;
        res.redirect(redirect_to);
    }).catch(function(error) {
        res.render('configure', {
            csrfToken: req.csrfToken(),
            page_title: "Almond - Setup",
            errors: [error.message]
        });
    });
});

router.get('/login', function(req, res, next) {
    res.render('login', {
        csrfToken: req.csrfToken(),
        errors: req.flash('error'),
        page_title: "Almond - Login"
    });
});


router.post('/login', passport.authenticate('local', { failureRedirect: '/user/login',
                                                       failureFlash: true }),
    function(req, res, next) {
        user.unlock(req, req.body.password);
        // Redirection back to the original page
        var redirect_to = req.session.redirect_to || '/';
        delete req.session.redirect_to;
        res.redirect(redirect_to);
    });

router.get('/logout', function(req, res, next) {
    req.logout();
    res.redirect('/');
});


module.exports = router;
