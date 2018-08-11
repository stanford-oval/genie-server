// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports.ENABLE_DB_ENCRYPTION = false;
module.exports.SEMPRE_URL = 'https://almond-nl.stanford.edu';
module.exports.NL_SERVER_URL = module.exports.SEMPRE_URL;
module.exports.THINGPEDIA_URL = 'https://thingpedia.stanford.edu/thingpedia';

module.exports.MS_SPEECH_RECOGNITION_PRIMARY_KEY = 'de1f02817356494483ba502b2ce95f6f';
module.exports.MS_SPEECH_RECOGNITION_SECONDARY_KEY = '3dc6ce0b832940f0b0c984a1517c457e';

// load more configuration that should not go in git (eg secret keys)
try {
    Object.assign(module.exports, require('./secret_config.js'));
} catch(e) {}