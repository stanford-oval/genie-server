// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

function ninvoke(obj, method, ...args) {
    return new Promise((resolve, reject) => {
        obj[method](...args, (err, ...res) => {
            if (err)
                reject(err);
            else if (res.length === 1)
                resolve(res[0]);
            else if (res.length === 0)
                resolve();
            else
                resolve(res);
        });
    });
}

module.exports = { ninvoke };
