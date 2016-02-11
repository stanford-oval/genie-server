// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const dbus = require('dbus-native');

var _sessionBus = null;
var _systemBus = null;

module.exports = {
    get session() {
        if (_sessionBus)
            return _sessionBus;

        _sessionBus = dbus.sessionBus();
        _sessionBus.on('end', function() { _sessionBus = null; });
        return _sessionBus;
    },

    get system() {
        if (_systemBus)
            return _systemBus;

        _systemBus = dbus.systemBus();
        // note: the system bus never dies! we'll be killed by systemd before that
        // happens
        return _systemBus;
    }
};
