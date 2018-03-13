// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const express = require('express');
var router = express.Router();

const user = require('../util/user');

router.get('/', user.redirectLogIn, (req, res, next) => {
    res.render('conversation', { page_title: req._("Almond - Chat") });
});

module.exports = router;
