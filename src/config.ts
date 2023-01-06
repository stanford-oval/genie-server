// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2017-2020 The Board of Trustees of the Leland Stanford Junior University
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

/**
 * Options passed to Genie conversations
 */
export const CONVERSATION_OPTIONS = {
  showWelcome: true,
  debug: true,
  log: true
};

/**
  The URL prefix at which all genie-server APIs and pages are exposed.

  This configuration is provided to simplify reverse-proxying genie-server.
  If set, it should start with a slash, not end in a slash, and have no two consecutive slashes.

  Good: /foo /foo/bar
  Bad: foo foo/ /foo/ /foo//bar
*/
export const BASE_URL = process.env.THINGENGINE_BASE_URL || '';

/**
  Set this to true if Genie is served behind a reverse proxy.

  If true, Genie will trust the X-Forwarded-* headers, the default host-based authentication
  will be "proxied-ip", and the default origin will not use a port.
*/
export const HAS_REVERSE_PROXY = !!process.env.THINGENGINE_HAS_REVERSE_PROXY;

/**
  Enable host-based authentication.

  Host-based authentication is an alternative authentication scheme that allows connections
  from localhost. It is useful to integrate Genie with other software, for example to build
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
export const HOST_BASED_AUTHENTICATION = process.env.THINGENGINE_HOST_BASED_AUTHENTICATION ||
    (HAS_REVERSE_PROXY ? 'proxied-ip' : 'local-ip');

/**
  Enable password-based DB encryption.

  If true, the engine will start locked until the user enters their password.

  NOTE: this feature is experimental and might cause problems. It is not recommended to
  enable by default. If enabled, you must build the server with sqlcipher as the sqlite backend
  (the default docker images do not do this).
*/
export const ENABLE_DB_ENCRYPTION = false;

/**
  Adjust operation to run inside an Home Assistant add-on.

  This affects the behavior of the OAuth proxy.
 */
export const IN_HOME_ASSISTANT_ADDON = !!process.env.THINGENGINE_IN_HOME_ASSISTANT_ADDON;

export const NLP_URL = process.env.THINGENGINE_NLP_URL || 'https://nlp.almond.stanford.edu';
export const THINGPEDIA_URL = process.env.THINGPEDIA_URL || 'https://genie.stanford.edu/thingpedia';
export const CLOUD_SYNC_URL = process.env.THINGENGINE_CLOUD_SYNC_URL || 'https://genie.stanford.edu';
export const OAUTH_REDIRECT_URL = process.env.THINGENGINE_CLOUD_SYNC_URL || 'https://genie.stanford.edu';

/**
  For Forge Oauth
 */
  export const FORGE_CLIENT_ID = process.env.FORGE_CLIENT_ID || '';
  export const FORGE_CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET || '';
  export const FORGE_CALLBACK_URL = process.env.FORGE_CALLBACK_URL || '';
  export const scopes = {
    // Required scopes for the server-side application
    internal: ['bucket:create', 'bucket:read', 'data:read', 'data:create', 'data:write'],
    // Required scope for the client-side viewer
    public: ['viewables:read']
  };