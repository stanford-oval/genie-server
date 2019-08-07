// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const PulseAudio = require('pulseaudio2');

const SpeechRecognizer = require('../service/speech_recognizer');
const readline = require('readline');

function main() {
    let recognizer = new SpeechRecognizer({
        locale: 'en-US'
    });
    let pulseCtx = new PulseAudio();

    function makeRequest() {
        return new Promise((callback, errback) => {
            let stream = pulseCtx.createRecordStream({ format: 'S16LE', rate: 16000, channels: 1 });
            stream.on('state', (state) => {
                if (state === 'ready')
                    console.log('Speak now...');
            });

            let request = recognizer.request(null, stream);
            request.on('ready', () => console.log('Speak now...'));
            request.on('hypothesis', (hyp) => console.log('Hypothesis: ' + hyp));
            request.on('done', (status, phrase) => {
                console.log('Done: ' + status);
                if (status === 'Success')
                    console.log(phrase);
                callback();
            });
        });
    }

    var rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.setPrompt('$ ');

    function help() {
        console.log('Available console commands:');
        console.log('\\q: quit');
        console.log('\\s: speak');
        console.log('\\? or \\h: this help');
        rl.prompt();
    }
    function quit() {
        recognizer.close();
        pulseCtx.end();
        rl.close();
    }

    rl.on('line', function(line) {
        if (line.trim().length === 0) {
            rl.prompt();
            return;
        }
        if (line === '\\q')
            quit();
        else if (line === '\\h' || line === '\\?')
            help();
        else if (line === '\\s')
            return makeRequest().then(() => rl.prompt());
        else
            console.log('Unknown command ' + line);
        rl.prompt();
    });
    rl.prompt();
}
main();
