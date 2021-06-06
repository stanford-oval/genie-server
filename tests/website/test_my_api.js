// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019-2020 The Board of Trustees of the Leland Stanford Junior University
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>

import assert from 'assert';
import WebSocket from 'ws';
import { assertHttpError, request, sessionRequest } from './scaffold';
import { login, } from './login';

async function getAccessToken(session) {
    return JSON.parse(await sessionRequest('/user/token', 'POST', '', session, {
        accept: 'application/json',
    })).token;
}

async function testMyApiInvalid(auth) {
    await assertHttpError(request('/api/invalid', 'GET', null, { auth }), 404);
}

async function testMyApiCreateGetApp(auth) {
    const result = JSON.parse(await request('/api/apps/create', 'POST', JSON.stringify({
        code: `now => @org.thingpedia.builtin.test(id="org.thingpedia.builtin.test").get_data(count=2, size=10byte) => notify;`
    }), { auth, dataContentType: 'application/json' }));

    assert(result.uniqueId.startsWith('uuid-'));
    assert.strictEqual(result.description, 'Get get data on test with count 2 and size 10 byte.');
    assert.strictEqual(result.code, '@org.thingpedia.builtin.test.get_data(count=2, size=10byte);');
    assert.strictEqual(result.icon, 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/org.thingpedia.builtin.test');
    assert.deepStrictEqual(result.errors, []);

    assert.deepStrictEqual(result.results, [{
        raw: {
            count: 2,
            data: '!!!!!!!!!!',
            size: 10
        },
        formatted: [{ type: 'text', text: 'The answer is !!!!!!!!!!' }],
        type: 'org.thingpedia.builtin.test:get_data'
    }, {
        raw: {
            count: 2,
            data: '""""""""""',
            size: 10
        },
        formatted: [{ type: 'text', text: 'The answer is """""""""".' }],
        type: 'org.thingpedia.builtin.test:get_data'
    }]);
}

function awaitConnect(ws) {
    return new Promise((resolve, reject) => {
        ws.on('open', resolve);
    });
}

async function testMyApiCreateWhenApp(auth) {
    const ws = new WebSocket('http://127.0.0.1:3000/api/results', {
        headers: {
            'Authorization': auth
        }
    });
    await awaitConnect(ws);

    const result = JSON.parse(await request('/api/apps/create', 'POST', JSON.stringify({
        code: `monitor(@org.thingpedia.builtin.test(id="org.thingpedia.builtin.test").get_data(size=10byte)) => notify;`
    }), { auth, dataContentType: 'application/json' }));

    assert(result.uniqueId.startsWith('uuid-'));
    assert.strictEqual(result.description, 'Notify me when there are new get data on test with size 10 byte.');
    assert.strictEqual(result.code, 'monitor(@org.thingpedia.builtin.test.get_data(size=10byte));');
    assert.strictEqual(result.icon, 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/org.thingpedia.builtin.test');
    assert.deepStrictEqual(result.results, []);
    assert.deepStrictEqual(result.errors, []);

    await new Promise((resolve, reject) => {
        let count = 0;
        ws.on('message', (data) => {
            const parsed = JSON.parse(data);
            if (parsed.result.appId !== result.uniqueId)
                return;
            delete parsed.result.raw.__timestamp;
            console.log(data);
            if (count === 0) {
                assert.deepStrictEqual(parsed, {
                    result: {
                        appId: result.uniqueId,
                        raw: { data: '!!!!!!!!!!', size: 10 },
                        type: 'org.thingpedia.builtin.test:get_data',
                        formatted: [{ type: 'text', text: 'Notification from Test: the answer is !!!!!!!!!!' }],
                        icon: 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/org.thingpedia.builtin.test'
                    }
                });
            } else {
                assert.deepStrictEqual(parsed, {
                    result: {
                        appId: result.uniqueId,
                        raw: { data: '""""""""""', size: 10 },
                        type: 'org.thingpedia.builtin.test:get_data',
                        formatted: [{ type: 'text', text: 'Notification from Test: the answer is """""""""".' }],
                        icon: 'https://thingpedia.stanford.edu/thingpedia/api/v3/devices/icon/org.thingpedia.builtin.test'
                    }
                });
            }
            if (++count === 2) {
                ws.close();
                resolve();
            }
        });
    });

    return result.uniqueId;
}

async function testMyApiListApps(auth, uniqueId) {
    const listResult = JSON.parse(await request('/api/apps/list', 'GET', null, { auth }));
    assert.deepStrictEqual(listResult, [{
        uniqueId,
        name: 'Test',
        description: 'Notify me when there are new get data on test with size 10 byte.',
        error: null,
        code: 'monitor(@org.thingpedia.builtin.test.get_data(size=10byte));',
        icon: 'org.thingpedia.builtin.test',
        isEnabled: true,
        isRunning: true,
    }]);

    const getResult = JSON.parse(await request('/api/apps/get/' + uniqueId, 'GET', null, { auth }));
    assert.deepStrictEqual(getResult, {
        uniqueId,
        name: 'Test',
        description: 'Notify me when there are new get data on test with size 10 byte.',
        error: null,
        code: 'monitor(@org.thingpedia.builtin.test.get_data(size=10byte));',
        icon: 'org.thingpedia.builtin.test',
        isEnabled: true,
        isRunning: true,
    });

    await assertHttpError(request('/api/apps/get/uuid-invalid', 'GET', null, { auth }), 404);
}

async function testMyApiDeleteApp(auth, uniqueId) {
    const result = JSON.parse(await request('/api/apps/delete/' + uniqueId, 'POST', '', { auth }));
    assert.deepStrictEqual(result, { status: 'ok' });

    const listResult = JSON.parse(await request('/api/apps/list', 'GET', null, { auth }));
    assert.deepStrictEqual(listResult, []);

    await assertHttpError(request('/api/apps/delete/uuid-invalid', 'POST', '', { auth }), 404);
}

async function testMyApiDevices(auth) {
    const listResult = JSON.parse(await request('/api/devices/list', 'GET', null, { auth }));

    assert.deepStrictEqual(listResult, [
      { uniqueId: 'org.thingpedia.builtin.thingengine.server',
        name: 'Almond Smart Speaker',
        description: 'Commands that are specific to using Almond as a smart-speaker device.',
        kind: 'org.thingpedia.builtin.thingengine.server',
        version: 0,
        class: 'data',
        ownerTier: 'global',
        isTransient: false,
        authType: 'builtin' },
      { uniqueId: 'thingengine-own-server:81e0e8abba27202a',
        name: 'Genie server (:81e0e8abba27202a)',
        description: 'This is one of your Genie apps.',
        kind: 'org.thingpedia.builtin.thingengine',
        version: 0,
        ownerTier: 'server',
        class: 'system',
        isTransient: false,
        authType: 'builtin' },
      { uniqueId: 'org.thingpedia.builtin.thingengine.builtin',
        name: 'Miscellaneous Interfaces',
        description: 'Time, random numbers, and other commands not specific to any skill.',
        kind: 'org.thingpedia.builtin.thingengine.builtin',
        version: 0,
        ownerTier: 'global',
        class: 'data',
        isTransient: true,
        authType: 'builtin' },
      { uniqueId: 'org.thingpedia.builtin.test',
        name: 'Test Device',
        description: 'Test Genie in various ways',
        kind: 'org.thingpedia.builtin.test',
        version: 0,
        ownerTier: 'global',
        class: 'system',
        isTransient: true,
        authType: 'builtin' },
    ]);

    const createResult = JSON.parse(await request('/api/devices/create', 'POST', JSON.stringify({
        kind: 'com.xkcd',
    }), { auth, dataContentType: 'application/json' }));
    delete createResult.version;

    assert.deepStrictEqual(createResult, {
        uniqueId: 'com.xkcd',
        name: 'XKCD',
        description: 'A webcomic of romance, sarcasm, math, and language.',
        kind: 'com.xkcd',
        ownerTier: 'global',
        class: 'data',
        isTransient: false,
        authType: 'none'
    });

    const listResult2 = JSON.parse(await request('/api/devices/list', 'GET', null, { auth }));
    listResult2[listResult2.length-1].version = 0;
    assert.deepStrictEqual(listResult2, [
      { uniqueId: 'org.thingpedia.builtin.thingengine.server',
        name: 'Almond Smart Speaker',
        description: 'Commands that are specific to using Almond as a smart-speaker device.',
        kind: 'org.thingpedia.builtin.thingengine.server',
        version: 0,
        class: 'data',
        ownerTier: 'global',
        isTransient: false,
        authType: 'builtin' },
      { uniqueId: 'thingengine-own-server:81e0e8abba27202a',
        name: 'Genie server (:81e0e8abba27202a)',
        description: 'This is one of your Genie apps.',
        kind: 'org.thingpedia.builtin.thingengine',
        version: 0,
        ownerTier: 'server',
        class: 'system',
        isTransient: false,
        authType: 'builtin' },
      { uniqueId: 'org.thingpedia.builtin.thingengine.builtin',
        name: 'Miscellaneous Interfaces',
        description: 'Time, random numbers, and other commands not specific to any skill.',
        kind: 'org.thingpedia.builtin.thingengine.builtin',
        version: 0,
        ownerTier: 'global',
        class: 'data',
        isTransient: true,
        authType: 'builtin' },
      { uniqueId: 'org.thingpedia.builtin.test',
        name: 'Test Device',
        description: 'Test Genie in various ways',
        kind: 'org.thingpedia.builtin.test',
        version: 0,
        ownerTier: 'global',
        class: 'system',
        isTransient: true,
        authType: 'builtin' },
      { uniqueId: 'com.xkcd',
        name: 'XKCD',
        description: 'A webcomic of romance, sarcasm, math, and language.',
        kind: 'com.xkcd',
        version: 0,
        ownerTier: 'global',
        class: 'data',
        isTransient: false,
        authType: 'none' }
    ]);
}


async function testMyApiConverse(auth) {
    // ignore the first conversation result as that will show the welcome message
    const result0 = JSON.parse(await request('/api/converse', 'POST', JSON.stringify({
        command: {
            type: 'command',
            text: 'hello',
        },
    }), { auth, dataContentType: 'application/json' }));

    const result1 = JSON.parse(await request('/api/converse', 'POST', JSON.stringify({
        conversationId: result0.conversationId,
        command: {
            type: 'tt',
            code: 'now => @org.thingpedia.builtin.test.dup_data(data_in="foo") => notify;',
        }
    }), { auth, dataContentType: 'application/json' }));
    delete result1.conversationId;
    delete result1.messages[1].uniqueId;
    assert.deepStrictEqual(result1, {
        askSpecial: null,
        messages: [{
            id: 2,
            type: 'command',
            command: '\\t now => @org.thingpedia.builtin.test.dup_data(data_in="foo") => notify;',
        }, {
            id: 3,
            type: 'new-program',
            code: '@org.thingpedia.builtin.test.dup_data(data_in="foo");',
            errors: [],
            icon: 'org.thingpedia.builtin.test',
            name: 'Test',
            results: [{
                data_in: 'foo',
                data_out: 'foofoo'
            }],
        }, {
            id: 4,
            type: 'text',
            text: 'The answer is foofoo.',
            icon: 'org.thingpedia.builtin.test'
        }]
    });

    const result2 = JSON.parse(await request('/api/converse', 'POST', JSON.stringify({
        conversationId: result0.conversationId,
        command: {
            type: 'command',
            text: 'yes',
        },
    }), { auth, dataContentType: 'application/json' }));
    delete result2.conversationId;
    assert.deepStrictEqual(result2, {
        askSpecial: null,
        messages: [{
            id: 5,
            type: 'command',
            command: 'yes',
        }, {
            id: 6,
            type: 'text',
            text: 'Sorry, I did not understand that. Can you rephrase it?',
            icon: 'org.thingpedia.builtin.test'
        }],
    });
}

async function testMyApiOAuth(accessToken) {
    const auth = 'Bearer ' + accessToken;

    // /profile
    await testMyApiCreateGetApp(auth);
    const uniqueId = await testMyApiCreateWhenApp(auth);
    await testMyApiListApps(auth, uniqueId);
    await testMyApiDeleteApp(auth, uniqueId);
    await testMyApiDevices(auth);
    await testMyApiInvalid(auth);
    await testMyApiConverse(auth);
}

async function main() {
    const bob = await login();

    // user (web almond) api
    const token = await getAccessToken(bob);
    await testMyApiOAuth(token);
}
export default main;
if (!module.parent)
    main();
