// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Albert Chen <hselin.chen@gmail.com>
//
// See COPYING for details

const lang = require('lang');
const alljoyn = require('alljoyn');

function check(ok) {
    if (ok != 0)
        throw new Error('Alljoyn Call failed with error ' + ok);
}

module.exports = new lang.Class({
    Name: 'AllJoynApi',

    _init: function() {
    },

    start: function(appName) {
        this._bus = alljoyn.BusAttachment(appName);
        check(this._bus.start());

        // we use the regular dbus session bus if one is available
        // this allows easy debugging with d-feet and similar tools
        var dbusAddress = process.env.DBUS_SESSION_BUS_ADDRESS;

        if (dbusAddress)
            check(this._bus.connect(dbusAddress));
        else
            check(this._bus.connect())
    },

    createInterface: function(name, descr) {
        var iface = alljoyn.InterfaceDescription();
        check(this._bus.createInterface(name, iface));

        for (var name in descr.signals)
            check(iface.addSignal(name, descr.signals[name][0], descr.signals[name][1]));
        for (var name in descr.methods)
            check(iface.addMethod(name, descr.methods[name][0], descr.methods[name][1], descr.methods[name][2]));

        iface.activate();
        return iface;
    },

    createObject: function(path, ifaces) {
        var obj = alljoyn.BusObject(path);
        ifaces.forEach(function(iface) { check(obj.addInterface(iface)); });
        return obj;
    },

    exportObject: function(obj) {
        check(this._bus.registerBusObject(obj));
    },

    exportSessionPort: function(port) {
        var listener = alljoyn.SessionPortListener(function(port, joiner){
            console.log('Received incoming session request');
            // accept all session requests for now
            return true;
        }, function(port, sessionID, joiner){
            console.log('Joined session ' + sessionID);
        }.bind(this));

        // bind a port for 1-to-1 communication
        try {
            check(this._bus.bindSessionPort(port, listener));
        } catch(e) {
            // eat the error: it likely means that we're running of regular
            // d-bus instead of alloyn d-bus, and we don't have an alljoyn
            // router that knows about session ports
            // not too bad, stuff will be sessionless
        }
    },

    exportName: function(name) {
        // ask the bus to own the well-known name
        check(this._bus.requestName(name));
        try {
            // and start advertising it over the local network
            check(this._bus.advertiseName(name));
        } catch(e) {
            // eat the error: it likely means that we're running of regular
            // d-bus instead of alloyn d-bus, and we don't have an alljoyn
            // router that knows about session advertisements
        }
    },

    unexportName: function(name) {
        try {
            // and start advertising it over the local network
            check(this._bus.cancelAdvertiseName(name));
        } catch(e) {
            // eat the error: it likely means that we're running of regular
            // d-bus instead of alloyn d-bus, and we don't have an alljoyn
            // router that knows about session advertisements
        }
        check(this._bus.releaseName(name));
    }
});
