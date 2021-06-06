// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
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

import * as stream from 'stream';
import * as child_process from 'child_process';
import byline from 'byline';
import * as path from 'path';

// This file is based on mycroft-precise/runner/runner.py
//
// Copyright 2019 Mycroft AI Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
  Reads predictions and detects activations

  This prevents multiple close activations from occurring when
  the predictions look like ...!!!..!!...
*/
class TriggerDetector {
    constructor(chunk_size, sensitivity=0.5, trigger_level=3) {
        this.chunk_size = chunk_size;
        this.sensitivity = sensitivity;
        this.trigger_level = trigger_level;
        this.activation = 0;
    }

    /**
      Returns whether the new prediction caused an activation
    */
    update(prob) {
        // type: (float) -> bool
        const chunk_activated = prob > 1.0 - this.sensitivity;

        if (chunk_activated || this.activation < 0) {
            this.activation += 1;
            const has_activated = this.activation > this.trigger_level;
            if (has_activated || (chunk_activated && this.activation < 0))
                this.activation = Math.floor(-(8 * 2048) / this.chunk_size);

            if (has_activated)
                return true;
        } else if (this.activation > 0) {
            this.activation -= 1;
        }
        return false;
    }
}

export default class DetectorStream extends stream.Writable {
    constructor() {
        // keep chunks small, to reduce latency
        super({ highWaterMark: 128 });

        this._modelPath = path.resolve(path.dirname(module.filename), '../../../data/wake-word/almond.net');
        this._hotword = path.basename(this._modelPath).split('.')[0];

        this._detector = new TriggerDetector(2048);
        this._child = null;
        this._startChild();

        this._chunkBuffers = [];
        this._chunkLength = 0;
    }

    _write(buffer, encoding, callback) {
        this._chunkBuffers.push(buffer);
        this._chunkLength += buffer.length;

        if (this._chunkLength >= 2048) {
            const concat = Buffer.concat(this._chunkBuffers, this._chunkLength);

            this._chunkBuffers = [];
            this._chunkLength = 0;
            if (this._child)
                this._child.stdin.write(concat, callback);
        } else {
            callback();
        }
    }

    _startChild() {
        if (this._child !== null)
            return;
        if (this._killed)
            return;

        this._child = child_process.spawn('precise-engine', [this._modelPath, '2048'], {
            stdio: ['pipe', 'pipe', 'inherit']
        });

        const parser = byline();
        this._child.stdout.setEncoding('utf8');
        this._child.stdout.pipe(parser);
        parser.on('data', (line) => {
            const value = parseFloat(line);
            if (isNaN(value))
                return;
            if (this._detector.update(value))
                this.emit('hotword', this._hotword);
        });

        this._child.on('error', (err) => {
            console.error('Failed to spawn precise-engine:', err);
            this._child = null;

            // autorespawn
            setTimeout(() => this._startChild(), 30000);
        });
        this._child.on('exit', (status) => {
            if (this._killed)
                return;

            console.error('Unexpected exit of precise-engine:', status);
            this._child.stdin.unpipe(this);
            this._child = null;

            // autorespawn
            setTimeout(() => this._startChild(), 30000);
        });
    }

    destroy() {
        this._killed = true;

        if (this._child)
            this._child.kill();
    }
}
