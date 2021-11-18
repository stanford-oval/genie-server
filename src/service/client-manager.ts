// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2021 The Board of Trustees of the Leland Stanford Junior University
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

import * as crypto from 'crypto';
import * as path from 'path';
import * as child_process from 'child_process';
import ConfigParser from 'configparser';

import platform from './platform';

import * as Config from '../config';

/**
 * Manage a genie client running in the same container/machine as almond-server
 */
export default class ClientManager {
    private _child : child_process.ChildProcess|null;
    private _port : number;

    constructor(port : number) {
        this._child = null;
        this._port = port;
    }

    async start() {
        const config = new ConfigParser();
        const configfilepath = path.resolve(platform.getWritableDir(), 'config.ini');

        try {
            await config.readAsync(configfilepath);
        } catch(e) {
            if (e.code !== 'ENOENT')
                throw e;
        }

        if (!config.hasSection('general'))
            config.addSection('general');
        config.set('general', 'url', `ws://127.0.0.1:${this._port}/api/conversation`);
        config.set('general', 'conversationId', 'main');

        if (Config.HOST_BASED_AUTHENTICATION === 'disabled') {
            config.set('general', 'auth_mode', 'bearer');

            const prefs = platform.getSharedPreferences();
            let accessToken = prefs.get('access-token') as string|undefined;
            if (accessToken === undefined) {
                accessToken = crypto.randomBytes(32).toString('hex');
                prefs.set('access-token', accessToken);
            }

            config.set('general', 'accessToken', accessToken);
        } else {
            config.set('general', 'auth_mode', 'none');
        }

        await config.writeAsync(configfilepath);

        this._child = child_process.spawn('genie-client', {
            stdio: 'inherit',
            cwd: platform.getWritableDir(),
            detached: false
        });
    }

    async stop() {
        if (this._child)
            this._child.kill('SIGTERM');
    }
}
