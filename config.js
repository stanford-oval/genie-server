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
  Enable host-based authentication.

  Host-based authentication is an alternative authentication scheme that allows connections
  from localhost. It is useful to integrate Almond with other software, for example to build
  a smart gateway or smart speaker product.

  The following options are allowed:

  - `disabled`: host-based authentication is disabled entirely
  - `local-ip`: the client is allowed to connect if their IP is 127.0.0.1
  - `proxied-ip`: the client is allowed to connect if their IP is 127.0.0.1; if proxied, this
     considers the IP of the client, not the proxy (using X-Forwared-For)
  - `insecure`: all clients are allowed to connect, regardless of their IP

  `local-ip` mode is suitable for an appliance where all software running on the appliance
  is centrally administered; it is also suitable for a deployment with a proxy, where the proxy
  implements authentication. `insecure` is NOT recommended, and should be used only with firewalls
  or other network-level protections.

  NOTE: host-based authentication is not compatible with DB encryption.
*/
module.exports.HOST_BASED_AUTHENTICATION = process.env.THINGENGINE_HOST_BASED_AUTHENTICATION || 'local-ip';

/**
  Enable password-based DB encryption.

  If true, the engine will start locked until the user enters their password.

  NOTE: this feature is experimental and might cause problems. It is not recommended to
  enable by default. If enabled, you must build the server with sqlcipher as the sqlite backend
  (the default docker images do not do this).
*/
module.exports.ENABLE_DB_ENCRYPTION = false;


module.exports.SEMPRE_URL = 'https://nlp-staging.almond.stanford.edu';
module.exports.THINGPEDIA_URL = 'https://thingpedia.stanford.edu/thingpedia';
module.exports.MS_SPEECH_RECOGNITION_PRIMARY_KEY = 'de1f02817356494483ba502b2ce95f6f';
module.exports.MS_SPEECH_RECOGNITION_SECONDARY_KEY = '3dc6ce0b832940f0b0c984a1517c457e';

