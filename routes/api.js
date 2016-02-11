// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');

const user = require('../util/user');

module.exports = function(app) {
    app.post('/api/callback/add', user.requireLogIn, function(req, res, next) {
        try {
            var id = app.engine.ui.registerCallback(req.body);
            res.json({ result: 'ok', id: id });
        } catch(e) {
            res.json({ result: 'error', error: e.message });
        }
    });

    app.post('/api/callback/remove', user.requireLogIn, function(req, res, next) {
        try {
            app.engine.ui.registerCallback(req.body.id);
            res.json({ result: 'ok' });
        } catch(e) {
            res.json({ result: 'error', error: e.message });
        }
    });

    app.post('/api/callback/input/:id', user.requireLogIn, function(req, res, next) {
        Q.try(function() {
            return app.engine.ui.getInput(req.params.id);
        }).then(function(pipe) {
            pipe.sendEvent(req.body);
            return pipe.close();
        }).then(function() {
            res.json({ result: 'ok' });
        }).catch(function(e) {
            res.json({ result: 'error', error: error.message });
        }).done();
    })

    app.ws('/api/callback/stream/:id', function(ws, req) {
        var id = req.params.id;

        Q.try(function() {
            return app.engine.ui.getNotify(req.params.id);
        }).then(function(pipe) {
            var handler = function(data) {
                ws.send(JSON.stringify(data));
            };
            pipe.on('data', handler);

            ws.on('close', function() {
                pipe.removeListener('data', handler);
                pipe.close().done();
            });
        }).catch(function(e) {
            console.log('Error while opening notify stream');
            console.log(e.stack);
            ws.close();
        }).done();
    });
}

