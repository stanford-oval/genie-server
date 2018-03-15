// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Brassau
//
// Copyright 2017-2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Michael Fischer <mfischer@cs.stanford.edu>
//         Giovanni Campagna <gcampagn@cs.stanford.edu>
//         Silei Xu <silei@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports = {
    onmessage: null,
    connect() {
        let url = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/api/results';
        this._resultsws = new WebSocket(url);
        this._resultsws.onclose = () => {
            console.log('results websocket closed');
            this._resultsws = null;
            setTimeout(() => {
                this.connect();
            }, 5000);
        };
        this._resultsws.onmessage = (event) => {
            this.onmessage(JSON.parse(event.data));
        };
    },

    createApp(params) {
        return Promise.resolve($.ajax('/api/apps/create', {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(params)
        }));
    },

    deleteApp(appId) {
        return Promise.resolve($.ajax('/api/apps/delete/' + appId, {
            method: 'POST',
            data: ''
        }));
    },

    parseCommand(command) {
        return Promise.resolve($.ajax({
            url:  '/api/parse',
            data: {
                command: command
            },
            contentType: 'application/json'
        }));
    }
};