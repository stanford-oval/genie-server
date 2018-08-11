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

const Q = require('q');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const events = require('events');
const stream = require('stream');
const rpc = require('transparent-rpc');

const user = require('../model/user');
const db = require('../util/db');

class ChildProcessSocket extends stream.Duplex {
    constructor(child) {
        super({ objectMode: true });

        this._child = child;
    }

    _read() {}

    _write(data, encoding, callback) {
        this._child.send({ type: 'rpc', data: data }, null, callback);
    }
}

function safeMkdirSync(dir) {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if (e.code !== 'EEXIST')
            throw e;
    }
}

class EngineProcess extends events.EventEmitter {
    constructor(userId) {
        super();
        this.setMaxListeners(Infinity);

        this._userId = userId;

        this.useCount = 0;

        this._cwd = platform.getChildDirectory(userId);
        this._cacheDir = platform.getChildCacheDirectory(userId);
        safeMkdirSync(this._cwd);
        safeMkdirSync(this._cacheDir);
        this._child = null;
        this._rpcSocket = null;
        this._rpcId = null;

        this._hadExit = false;
    }

    runEngine() {
        this.useCount++;
        return this._rpcSocket.call(this._rpcId, 'runEngine', [{
            userId: this._userId,
            cacheDir: this._cacheDir,
        }]);
    }

    kill() {
        if (this._child === null)
            return;

        console.log('Killing process with ID ' + this._userId);
        this._child.kill();

        // emit exit immediately so we close the channel
        // otherwise we could race and try to talk to the dying process
        this._hadExit = true;
        this.emit('exit');
    }

    restart(delay) {
        this._child = null;
        this._rpcSocket = null;
        this._rpcId = null;
        return this._starting = Q.delay(delay).then(() => this.start());
    }

    waitReady() {
        return Promise.resolve(this._starting).then(() => this);
    }

    send(msg, socket) {
        this._child.send(msg, socket);
    }

    start() {
        const ALLOWED_ENVS = ['LANG', 'LOGNAME', 'USER', 'PATH',
                              'HOME', 'SHELL', 'THINGENGINE_PROXY'];
        function envIsAllowed(name) {
            if (name.startsWith('LC_'))
                return true;
            if (ALLOWED_ENVS.indexOf(name) >= 0)
                return true;
            return false;
        }

        const env = {};
        for (var name in process.env) {
            if (envIsAllowed(name))
                env[name] = process.env[name];
        }
        env.THINGENGINE_USER_ID = this._userId;

        const managerPath = path.dirname(module.filename);
        const enginePath = path.resolve(managerPath, './worker');
        let child;

        console.log('Spawning process with ID ' + this._userId);

        let processPath, args, stdio;
        if (true || process.env.THINGENGINE_DISABLE_SANDBOX === '1') {
            processPath = process.execPath;
            args = process.execArgv.slice();
            args.push(enginePath);
            stdio = ['ignore', 1, 2, 'ipc'];
        } else {
            processPath = path.resolve(managerPath, '../sandbox/sandbox');
            args = ['-i', this._cloudId, process.execPath].concat(process.execArgv);
            args.push(enginePath);
            stdio = ['ignore', 'ignore', 'ignore', 'ipc'];
        }
        child = child_process.spawn(processPath, args,
                                    { stdio: stdio,
                                      detached: true,
                                      cwd: this._cwd, env: env });

        // wrap child into something that looks like a Stream
        // (readable + writable)
        const socket = new ChildProcessSocket(child);
        this._rpcSocket = new rpc.Socket(socket);

        return this._starting = new Promise((resolve, reject) => {
            child.on('error', (error) => {
                console.error('Child with ID ' + this._userId + ' reported an error: ' + error);
                reject(new Error('Reported error ' + error));
            });
            child.on('exit', (code, signal) => {
                if (this.shared || code !== 0)
                    console.error('Child with ID ' + this._userId + ' exited with code ' + code);
                reject(new Error('Exited with code ' + code));
                if (!this._hadExit) {
                    this._hadExit = true;
                    this.emit('exit');
                }
            });
            socket.on('error', (error) => {
                console.error('Failed to communicate with ID ' + this._userId + ': ' + error);
            });

            this._child = child;
            child.on('message', (msg) => {
                switch (msg.type) {
                case 'ready':
                    this._rpcId = msg.id;
                    this._starting = null;
                    resolve();
                    break;
                case 'rpc':
                    socket.push(msg.data);
                    break;
                }
            });
        });
    }
}

class EngineManager extends events.EventEmitter {
    constructor(platform) {
        super();
        this._processes = {};
        this._engines = {};
    }

    getEngine(userId) {
        if (!this._engines[userId])
            return Promise.reject(new Error(`Engine for ${userId} is not running`));

        const wrapper = this._engines[userId];
        const engine = wrapper.engine;
        return Promise.all([engine.apps, engine.devices,
                            engine.messaging]).then(([apps, devices, messaging]) => {
            return {
                apps: apps,
                devices: devices,
                messaging: messaging,
                assistant: wrapper.assistant
            };
        });
    }

    _findProcessForUser(user) {
        const child = new EngineProcess(user.id);
        this._processes[user.id] = child;
        child.on('exit', () => {
            if (this._processes[user.id] === child)
                delete this._processes[user.id];
        });
        return child.start().then(() => child);
    }

    _runUser(user) {
        var engines = this._engines;
        var obj = { process: null,
                    engine: null,
                    assistant: null,
                    user: { name: user.username,
                            anonymous: false }
                  };
        engines[user.id] = obj;
        var die = () => {
            if (engines[user.id] !== obj)
                return;
            obj.process.removeListener('die', die);
            obj.process.removeListener('engine-removed', onRemoved);
            delete engines[user.id];
        };
        var onRemoved = (deadUserId) => {
            if (user.id !== deadUserId)
                return;

            die(true);
        };

        return this._findProcessForUser(user).then((child) => {
            console.log('Running engine for user ' + user.id);

            obj.process = child;

            child.on('engine-removed', onRemoved);
            child.on('exit', die);
            return child.runEngine();
        }).then((engine, assistant) => {
            obj.engine = engine;
            obj.assistant = assistant;
        });
    }

    isRunning(userId) {
        return (this._engines[userId] !== undefined && this._engines[userId].process !== null);
    }

    getProcessId(userId) {
        return (this._engines[userId] !== undefined && this._engines[userId].process !== null) ? this._engines[userId].process.id : -1;
    }

    sendSocket(userId, replyId, socket) {
        if (this._engines[userId] === undefined)
            throw new Error('Invalid user ID');
        if (this._engines[userId].process === null)
            throw new Error('Engine dead');

        this._engines[userId].process.send({ type: 'direct', target: userId, replyId: replyId }, socket);
    }

    start() {
        return db.withClient((client) => {
            return user.getAll(client).then((rows) => {
                return Promise.all(rows.map((r) => {
                    return this._runUser(r).catch((e) => {
                        console.error('User ' + r.id + ' failed to start: ' + e.message);
                    });
                }));
            });
        });
    }

    startUser(userId) {
        console.log('Requested start of user ' + userId);
        return db.withClient((dbClient) => {
            return user.get(dbClient, userId);
        }).then((user) => {
            return this._runUser(user);
        });
    }

    stop() {
        this.killAllUsers();
    }

    killAllUsers() {
        for (let userId in this._processes)
            this._processes[userId].kill();
    }

    killUser(userId) {
        let obj = this._engines[userId];
        if (!obj || obj.process === null)
            return Promise.resolve();
        return Promise.resolve(obj.process.killEngine(userId));
    }

    deleteUser(userId) {
        let obj = this._engines[userId];
        if (obj.process !== null)
            obj.process.killEngine(userId);

        return Q.nfcall(child_process.exec, 'rm -fr ./' + obj.userId);
    }

    restartUser(userId) {
        return this.killUser(userId).then(() => {
            return this.startUser(userId);
        });
    }
}
EngineManager.prototype.$rpcMethods = ['isRunning', 'getProcessId', 'startUser', 'killUser', 'killAllUsers', 'deleteUser', 'restartUser'];

module.exports = EngineManager;