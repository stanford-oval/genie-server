// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

/**
  The URL prefix at which all almond-server APIs and pages are exposed.

  This configuration is provided to simplify reverse-proxying almond-server.
  If set, it should start with a slash, not end in a slash, and have no two consecutive slashes.

  Good: /foo /foo/bar
  Bad: foo foo/ /foo/ /foo//bar
*/
module.exports.BASE_URL = process.env.THINGENGINE_BASE_URL || '';

/**
  Enable password-based DB encryption.

  If true, the engine will start locked until the user enters their password.
*/
module.exports.ENABLE_DB_ENCRYPTION = false;


module.exports.SEMPRE_URL = 'https://almond-nl.stanford.edu';
module.exports.THINGPEDIA_URL = 'https://thingpedia.stanford.edu/thingpedia';
module.exports.MS_SPEECH_RECOGNITION_PRIMARY_KEY = 'de1f02817356494483ba502b2ce95f6f';
module.exports.MS_SPEECH_RECOGNITION_SECONDARY_KEY = '3dc6ce0b832940f0b0c984a1517c457e';

