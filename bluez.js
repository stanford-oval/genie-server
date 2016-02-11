// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

// Server platform implementation of Bluetooth API, using BlueZ
// over DBus

const Q = require('q');
const events = require('events');
const fs = require('fs');
const lang = require('lang');
const dbus = require('dbus-native');

const DBusUtils = require('./dbus');

const BLUEZ_SERVICE = 'org.bluez';
const BLUEZ_MANAGER_PATH = '/';
const BLUEZ_ADAPTER_INTERFACE = 'org.bluez.Adapter1';
const BLUEZ_DEVICE_INTERFACE = 'org.bluez.Device1';

const OBJECT_MANAGER_INTERFACE = 'org.freedesktop.DBus.ObjectManager';
const PROPERTY_INTERFACE = 'org.freedesktop.DBus.Properties';

function normalizeDevice(bluezprops) {
    return {
        uuids: bluezprops.UUIDs,
        alias: bluezprops.Alias,
        address: bluezprops.Address,
        paired: bluezprops.Paired,
        trusted: bluezprops.Trusted,
        class: bluezprops.Class || 0,
    };
}

module.exports = new lang.Class({
    Name: 'BluezBluetooth',
    Extends: events.EventEmitter,

    _init: function() {
        this._systemBus = DBusUtils.system;
        this._systemBus.connection.on('error', function() { /* do nothing */ });
        this._defaultAdapter = null;
        this._defaultAdapterProperties = {};
        this._devices = {};

        this._discovering = false;
    },

    start: function() {
        return Q.ninvoke(this._systemBus, 'getInterface',
                         BLUEZ_SERVICE, BLUEZ_MANAGER_PATH, OBJECT_MANAGER_INTERFACE)
            .then(function(objmanager) {
                console.log('Obtained BlueZ object manager');

                this._objectManager = objmanager;

                this._objectManager.on('InterfacesAdded', this._interfacesAdded.bind(this));
                this._objectManager.on('InterfacesRemoved', this._interfacesRemoved.bind(this));

                return Q.ninvoke(objmanager, 'GetManagedObjects');
            }.bind(this)).then(function(objects) {
                objects.forEach(function(object) {
                    this._interfacesAdded(object[0], object[1]);
                }, this);
            }.bind(this)).catch(function(e) {
                console.log('Failed to start BlueZ service: ' + e.message);
            });
    },

    startDiscovery: function() {
        if (this._defaultAdapter === null)
            return;

        if (this._discovering)
            return;

        this._discovering = true;
        Q.ninvoke(this._defaultAdapter.as(BLUEZ_ADAPTER_INTERFACE), 'StartDiscovery').done();
    },

    stopDiscovery: function() {
        if (!this._discovering)
            return;

        this._discovering = false;
        Q.ninvoke(this._defaultAdapter.as(BLUEZ_ADAPTER_INTERFACE), 'StopDiscovery').done();
    },

    _interfacesAdded: function(objectpath, interfaces) {
        console.log('BlueZ interface added at ' + objectpath);

        if (interfaces.some(function(iface) { return iface[0] === BLUEZ_ADAPTER_INTERFACE; }))
            this._adapterAdded(objectpath);
        if (interfaces.some(function(iface) { return iface[0] === BLUEZ_DEVICE_INTERFACE; }))
            this._deviceAdded(objectpath);
    },

    _interfacesRemoved: function(objectpath) {
        console.log('BlueZ interface removed at ' + objectpath);

        if (this._defaultAdapter !== null &&
            this._defaultAdapter.name === objectpath) {
            this._defaultAdapter = null;
            this._discovering = false;

            this.emit('default-adapter-changed');
        }

        if (objectpath in this._devices) {
            var device = this._devices[objectpath];
            delete this._devices[objectpath];
            this.emit('device-removed', objectpath, device);
        }
    },

    _deviceAdded: function(objectpath) {
        console.log('Found BlueZ device at ' + objectpath);

        return Q.ninvoke(this._systemBus, 'getObject', BLUEZ_SERVICE, objectpath)
            .then(function(object) {
                object.as(PROPERTY_INTERFACE).on('PropertiesChanged', function() {
                    this._reloadDeviceProperties(object).then(function() {
                        this.emit('device-changed', objectpath, this._devices[objectpath]);
                    }.bind(this));
                }.bind(this));

                return this._reloadDeviceProperties(object);
            }.bind(this)).then(function() {
                this.emit('device-added', objectpath, this._devices[objectpath]);
            }.bind(this));
    },

    _reloadDeviceProperties: function(object) {
        return Q.ninvoke(object.as(PROPERTY_INTERFACE), 'GetAll', BLUEZ_DEVICE_INTERFACE)
            .then(function(props) {
                this._devices[object.name] = {};
                props.forEach(function(prop) {
                    var name = prop[0];
                    // prop[1] is a variant, so prop[1][0] is the signature and
                    // prop[1][1] is a tuple with one element, the actual value
                    var value = prop[1][1][0];
                    this._devices[object.name][name] = value;
                }, this);
                this._devices[object.name] = normalizeDevice(this._devices[object.name]);
            }.bind(this));
    },

    _adapterAdded: function(objectpath) {
        console.log('Found BlueZ adapter at ' + objectpath);

        if (this._defaultAdapter !== null)
            return;

        this._tryGetDefaultAdapter(objectpath).done();
    },

    _tryGetDefaultAdapter: function(objectpath) {
        return Q.ninvoke(this._systemBus, 'getObject', BLUEZ_SERVICE, objectpath)
            .then(function(object) {
                console.log('Obtained default BlueZ adapter at ' + objectpath);

                this._defaultAdapter = object;

                object.as(PROPERTY_INTERFACE).on('PropertiesChanged', function() {
                    this._reloadAdapterProperties().then(function() {
                        this.emit('default-adapter-changed');
                    }.bind(this)).done();
                }.bind(this));

                return this._reloadAdapterProperties();
            }.bind(this)).then(function() {
                this.emit('default-adapter-changed');
            }.bind(this));
    },

    _reloadAdapterProperties: function() {
        return Q.ninvoke(this._defaultAdapter.as(PROPERTY_INTERFACE), 'GetAll', BLUEZ_ADAPTER_INTERFACE)
            .then(function(props) {
                this._defaultAdapterProperties = {};
                props.forEach(function(prop) {
                    var name = prop[0];
                    // prop[1] is a variant, so prop[1][0] is the signature and
                    // prop[1][1] is a tuple with one element, the actual value
                    var value = prop[1][1][0];
                    this._defaultAdapterProperties[name] = value;
                }, this);
            }.bind(this));
    },
});
