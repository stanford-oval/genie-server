// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

let riffHeader = null;

module.exports = {
    getRIFFHeader(seconds) {
        if (riffHeader)
            return riffHeader;

        let length;
        if (!seconds)
            length = 0x7fff0000;
        else
            length = 16000 * 2 * seconds;

        riffHeader = Buffer.alloc(44);
        // the size of the chunks are chosen based on what GStreamer produces by default
        riffHeader.write('RIFF', 0);
        riffHeader.writeInt32LE(length + 0x24, 4);
        riffHeader.write('WAVE', 8);
        riffHeader.write('fmt ', 12);
        riffHeader.writeInt32LE(16, 16); // fmt pkt size
        riffHeader.writeInt16LE(1, 20); // format (1 = PCM)
        riffHeader.writeInt16LE(1, 22); // number of channels
        riffHeader.writeInt32LE(16000, 24); // sample rate
        riffHeader.writeInt32LE((16000 * 16 * 1)/8, 28); // byterate
        riffHeader.writeInt16LE((16 * 1)/8, 32); // byte per sample
        riffHeader.writeInt16LE(16, 34); // bits per sample
        riffHeader.write('data', 36);
        riffHeader.writeInt32LE(length, 40);
        return riffHeader;
    }
};