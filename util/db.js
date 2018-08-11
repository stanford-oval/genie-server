// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//           2018 Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const sqlite3 = require('sqlite3');
const fs = require('fs');
const Q = require('q');

const Config = require('../config');

function initializeDB() {
    const schema = `
create table users (
    id integer primary key,
    username text unique,
    password text,
    salt text,
    storage_key text,
    speaker_guid text
)`;
    const db = new sqlite3.Database(platform.getSqliteDB(),
                                    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
    db.serialize(() => {
        db.run('PRAGMA journal_mode=WAL');
        db.exec(schema);
    });
    return db;
}

let _db = null;
function getDB() {
    if (_db)
        return _db;

    if (!fs.existsSync(platform.getSqliteDB()))
        return _db = initializeDB();
    else
        return _db = new sqlite3.Database(platform.getSqliteDB(), sqlite3.OPEN_READWRITE);
}

function query(client, string, args) {
    return Q.ninvoke(client, 'run', string, args);
}

function selectAll(client, string, args) {
    return Q.ninvoke(client, 'all', string, args);
}

function selectOne(client, string, args) {
    return Q.ninvoke(client, 'get', string, args);
}

function withClient(callback) {
    return callback(getDB());
}

const _transactionQueue = new WeakMap;
function withTransaction(filename, key, transaction) {
    return withClient(filename, key, (client) => {
        let queue = _transactionQueue.get(client);
        if (!queue)
            queue = Promise.resolve();

        return new Promise((callback, errback) => {
            queue = queue.then(() => query(client, 'begin transaction', [])).then(() => {
                return transaction(client);
            }).then((result) => {
                return Q.ninvoke(client, 'run', 'commit', []).then(() => {
                    callback(result);
                });
            }).catch((err) => {
                return Q.ninvoke(client, 'run', 'rollback', []).then(() => {
                    errback(err);
                    // continue with the queue
                }, (rollerr) => {
                    console.error('Ignored error from ROLLBACK', rollerr);
                    errback(err);
                    // continue with the queue
                });
            });
            _transactionQueue.set(client, queue);
        });
    });
}

module.exports = {
    getDB,

    withClient,
    withTransaction,

    selectOne,
    selectAll,

    insertOne(client, string, args) {
        return new Promise((callback, errback) => {
            client.run(string, args, function(err) {
                if (err) {
                    errback(err);
                    return;
                }
                if (this.lastID === undefined)
                    errback(new Error("Row does not have ID"));
                else
                    callback(this.lastID);
            });
        });
    },

    query: query,
    create: query,
    drop: query
};
