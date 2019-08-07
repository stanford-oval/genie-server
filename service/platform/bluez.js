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

// Linux platform implementation of Bluetooth API, using BlueZ
// over DBus

const events = require('events');
const { ninvoke } = require('./utils');

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

module.exports = class BluezBluetooth extends events.EventEmitter {
    constructor(platform) {
        super();

        this._systemBus = platform.getCapability('dbus-system');
        this._systemBus.connection.on('error', () => { /* do nothing */ });
        this._defaultAdapter = null;
        this._defaultAdapterProperties = {};
        this._devices = {};

        this._discovering = false;
        this.ondeviceadded = null;
        this.ondevicechanged = null;
    }

    async start() {
        try {
            const objmanager = await ninvoke(this._systemBus,
                'getInterface', BLUEZ_SERVICE, BLUEZ_MANAGER_PATH, OBJECT_MANAGER_INTERFACE);
            console.log('Obtained BlueZ object manager');

            this._objectManager = objmanager;

            this._objectManager.on('InterfacesAdded', this._interfacesAdded.bind(this));
            this._objectManager.on('InterfacesRemoved', this._interfacesRemoved.bind(this));

            const objects = await ninvoke(objmanager, 'GetManagedObjects');
            objects.forEach((object) => {
                this._interfacesAdded(object[0], object[1]);
            });
        } catch (e) {
            console.error('Failed to start BlueZ service: ' + e.message);
        }
    }

    async stop() {
    }

    async startDiscovery() {
        if (this._defaultAdapter === null)
            return;

        if (this._discovering)
            return;

        this._discovering = true;
        await ninvoke(this._defaultAdapter.as(BLUEZ_ADAPTER_INTERFACE), 'StartDiscovery');
    }

    async stopDiscovery() {
        if (!this._discovering)
            return;

        this._discovering = false;
        await ninvoke(this._defaultAdapter.as(BLUEZ_ADAPTER_INTERFACE), 'StopDiscovery');
    }

    _interfacesAdded(objectpath, interfaces) {
        console.log('BlueZ interface added at ' + objectpath);

        if (interfaces.some((iface) => { return iface[0] === BLUEZ_ADAPTER_INTERFACE; }))
            this._adapterAdded(objectpath);
        if (interfaces.some((iface) => { return iface[0] === BLUEZ_DEVICE_INTERFACE; }))
            this._deviceAdded(objectpath);
    }

    _interfacesRemoved(objectpath) {
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
    }

    async readUUIDs(address) {
    }

    async _deviceAdded(objectpath) {
        console.log('Found BlueZ device at ' + objectpath);

        try {
            const object = await ninvoke(this._systemBus, 'getObject', BLUEZ_SERVICE, objectpath);
            object.as(PROPERTY_INTERFACE).on('PropertiesChanged', () => {
                this._reloadDeviceProperties(object).then(() => {
                    if (this.ondevicechanged)
                        this.ondevicechanged(null, this._devices[objectpath]);
                    //this.emit('device-changed', objectpath, this._devices[objectpath]);
                });
            });

            await this._reloadDeviceProperties(object);
            if (this.ondeviceadded)
                this.ondeviceadded(null, this._devices[objectpath]);
                //this.emit('device-added', objectpath, this._devices[objectpath]);
        } catch (e) {
            console.error('Error while processing new Bluez device: ' + e.message);
        }
    }

    async _reloadDeviceProperties(object) {
        const props = await ninvoke(object.as(PROPERTY_INTERFACE), 'GetAll', BLUEZ_DEVICE_INTERFACE);
        this._devices[object.name] = {};
        props.forEach((prop) => {
            var name = prop[0];
            // prop[1] is a variant, so prop[1][0] is the signature and
            // prop[1][1] is a tuple with one element, the actual value
            var value = prop[1][1][0];
            this._devices[object.name][name] = value;
        });
        this._devices[object.name] = normalizeDevice(this._devices[object.name]);
    }

    _adapterAdded(objectpath) {
        console.log('Found BlueZ adapter at ' + objectpath);

        if (this._defaultAdapter !== null)
            return;

        this._tryGetDefaultAdapter(objectpath);
    }

    async _tryGetDefaultAdapter(objectpath) {
        const object = await ninvoke(this._systemBus, 'getObject', BLUEZ_SERVICE, objectpath);
        console.log('Obtained default BlueZ adapter at ' + objectpath);

        this._defaultAdapter = object;

        object.as(PROPERTY_INTERFACE).on('PropertiesChanged', () => {
            this._reloadAdapterProperties().then(() => {
                this.emit('default-adapter-changed');
            });
        });

        await this._reloadAdapterProperties();
        this.emit('default-adapter-changed');
    }

    async _reloadAdapterProperties() {
        const props = await ninvoke(this._defaultAdapter.as(PROPERTY_INTERFACE), 'GetAll', BLUEZ_ADAPTER_INTERFACE);
        this._defaultAdapterProperties = {};
        props.forEach((prop) => {
            var name = prop[0];
            // prop[1] is a variant, so prop[1][0] is the signature and
            // prop[1][1] is a tuple with one element, the actual value
            var value = prop[1][1][0];
            this._defaultAdapterProperties[name] = value;
        });
    }
};
