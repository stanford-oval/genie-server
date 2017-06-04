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
    res.render('conversation', { page_title: req._("Almond - Chat") });
});

module.exports = router;
