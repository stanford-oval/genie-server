// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019-2021 The Board of Trustees of the Leland Stanford Junior University
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


import * as Tp from 'thingpedia';

class UnavailableError extends Error {
    constructor() {
        super('Sound is not supported in this version of Almond');
        this.code = 'ENOSUP';
    }
}

const PA_BASE_VOLUME = 65536;

function avg(array) {
    let sum = 0;
    for (let i = 0; i < array.length; i++)
        sum += array[i];
    return sum / array.length;
}

export default class ThingEngineServerDevice extends Tp.BaseDevice {
    constructor(engine, state) {
        super(engine, state);

        this.uniqueId = 'org.thingpedia.builtin.thingengine.server';
        this._pulseaudio = this.platform.getCapability('sound');
    }

    checkAvailable() {
        return Tp.Availability.AVAILABLE;
    }

    async _getDefaultSink() {
        if (!this._pulseaudio)
            throw new UnavailableError();
        const server = await this._pulseaudio.info();
        return (await this._pulseaudio.sink()).find((sink) => sink.name === server.default_sink_name);
    }

    async do_raise_volume() {
        const sink = await this._getDefaultSink();

        // set the volume preserving the balance
        const current = avg(sink.volume);
        const newvolume = Math.floor(Math.min(PA_BASE_VOLUME, current + PA_BASE_VOLUME * 0.1));
        await this._doSetVolume(sink, current, newvolume);

        // return the new volume
        return { volume: newvolume };
    }
    async do_lower_volume() {
        const sink = await this._getDefaultSink();

        const current = avg(sink.volume);
        const newvolume = Math.ceil(Math.max(0, current - PA_BASE_VOLUME * 0.1));
        await this._doSetVolume(sink, current, newvolume);

        // return the average volume as the volume
        return { volume: avg(sink.volume)/PA_BASE_VOLUME*100 };
    }
    async do_set_volume({ volume }) {
        const sink = await this._getDefaultSink();

        // set the volume preserving the balance
        const current = avg(sink.volume);
        await this._doSetVolume(sink, current, Math.round(volume * PA_BASE_VOLUME / 100));
    }

    async _doSetVolume(sink, current, volume) {
        if (current === 0) {
            for (let i = 0; i < sink.volume.length; i++)
                sink.volume[i] = volume;
        } else {
            for (let i = 0; i < sink.volume.length; i++)
                sink.volume[i] = Math.round(volume * sink.volume[i]/current);
        }

        // mute if we lowered to 0
        await this._pulseaudio.setSinkMute(sink.name, sink.volume.every((v) => v === 0));
        await this._pulseaudio.setSinkVolume(sink.name, sink.volume);
    }
    async do_mute() {
        const sink = await this._getDefaultSink();

        await this._pulseaudio.setSinkMute(sink.name, 1);
    }
    async do_unmute() {
        const sink = await this._getDefaultSink();

        await this._pulseaudio.setSinkMute(sink.name, 0);
    }
}
