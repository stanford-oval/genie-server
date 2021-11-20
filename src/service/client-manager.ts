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

import * as path from 'path';
import * as child_process from 'child_process';
import ConfigParser from 'configparser';
import PulseAudio from 'pulseaudio2';

import platform from './platform';

import * as Config from '../config';

const MODULE_ROLE_DUCKING_ARGUMENTS = 'trigger_roles=voice-assistant ducking_roles=music volume=20% global=true';

// FIXME reenable webrtc when Home Assistant enables it in the build of PulseAudio
//const MODULE_ECHO_CANCEL_ARGUMENTS = 'source_name=echosrc sink_name=echosink channels=2 rate=48000 aec_method=webrtc aec_args="analog_gain_control=0 digital_gain_control=1 agc_start_volume=255"';
const MODULE_ECHO_CANCEL_ARGUMENTS = 'source_name=echosrc sink_name=echosink rate=48000';

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

    private async _safeLoadModule(client : PulseAudio, modName : string, args : string) {
        try {
            await client.loadModule(modName, args);
        } catch(e) {
            console.error(`Failed to load PulseAudio module: ${e.message}`);
        }
    }

    private async _loadPulseConfig() {
        const client = new PulseAudio();

        const sinks = await client.sink();
        const hasEchoSink = sinks.some((s) => s.name === 'echosink');

        const modules = await client.modules();
        let hasRoleDucking = false;
        for (const mod of modules) {
            if (mod.name === 'module-role-ducking') {
                hasRoleDucking = true;
                if (mod.argument !== MODULE_ROLE_DUCKING_ARGUMENTS) {
                    await client.unloadModule(mod.index);
                    await this._safeLoadModule(client, 'module-role-ducking', MODULE_ROLE_DUCKING_ARGUMENTS);
                }
                break;
            }
        }

        if (!hasRoleDucking)
            await this._safeLoadModule(client, 'module-role-ducking', MODULE_ROLE_DUCKING_ARGUMENTS);

        if (!hasEchoSink)
            await this._safeLoadModule(client, 'module-echo-cancel', MODULE_ECHO_CANCEL_ARGUMENTS);
    }

    private async _writeConfig() {
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
            config.set('general', 'accessToken', prefs.get('access-token'));
        } else {
            config.set('general', 'auth_mode', 'none');
        }

        await config.writeAsync(configfilepath);
    }

    async start() {
        await Promise.all([
            this._loadPulseConfig(),
            this._writeConfig()
        ]);

        const env : NodeJS.ProcessEnv = {};
        Object.assign(env, process.env);
        env.PULSE_SINK = 'echosink';
        env.PULSE_SOURCE = 'echosrc';

        this._child = child_process.spawn('genie-client', {
            stdio: 'inherit',
            cwd: platform.getWritableDir(),
            env,
            detached: false
        });
    }

    async stop() {
        console.log('Stopping genie-client');
        if (this._child)
            this._child.kill('SIGTERM');
    }
}
