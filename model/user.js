// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const db = require('../util/db');

function create(client, user) {
    const KEYS = ['username', 'password', 'salt', 'storage_key'];
    KEYS.forEach((key) => {
        if (user[key] === undefined)
            user[key] = null;
    });
    const vals = KEYS.map((key) => user[key]);
    const marks = KEYS.map(() => '?');

    return db.insertOne(client,
        `insert into users(id, ${KEYS.join(',')}) values (null, ${marks.join(',')})`, vals).then((id) => {
        user.id = id;
        return user;
    });
}

module.exports = {
    get(client, id) {
        return db.selectOne(client, "select * from users where id = ?", [id]);
    },

    getByName(client, username) {
        return db.selectAll(client, "select * from users where username = ?", [username]);
    },

    create,

    update(client, id, user) {
        return db.query(client, "update users set ? where id = ?", [user, id]);
    },
    delete(client, id) {
        return db.query(client, "delete from users where id = ?", [id]);
    },

    getAll(client) {
        return db.selectAll(client, "select * from users");
    }
};