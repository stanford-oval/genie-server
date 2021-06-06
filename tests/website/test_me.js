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


const { assertHttpError, assertRedirect, assertLoginRequired, sessionRequest } = require('./scaffold');
const { login, startSession } = require('./login');

async function testMyStuff(bob, nobody) {
    await assertRedirect(sessionRequest('', 'GET', null, nobody, { followRedirects: false }), '/user/login');
}

async function testMyDevices(bob, nobody) {
    await assertRedirect(sessionRequest('/devices/create', 'GET', {}, nobody, { followRedirects: false }), '/user/login');

    // no need to test the non-error case for /devices, linkchecker does that

    await assertLoginRequired(sessionRequest('/devices/create', 'POST', { kind: 'com.nytimes' }, nobody));

    await assertHttpError(sessionRequest('/devices/create', 'POST', { }, bob),
        400, 'Missing or invalid parameter kind');
    await assertHttpError(sessionRequest('/devices/create', 'POST', { kind: '' }, bob),
        400, 'Missing or invalid parameter kind');
    //await assertHttpError(sessionRequest('/devices/create', 'POST', { kind: 'com.foo', invalid: [1, 2] }, bob),
    //    400, 'Missing or invalid parameter invalid');
    await assertHttpError(sessionRequest('/devices/create', 'POST', { kind: 'com.foo' }, bob),
        400, 'Error: Unexpected HTTP error 404');

    await assertRedirect(sessionRequest('/devices/create', 'POST', {
        kind: 'org.thingpedia.rss',
        url: 'https://almond.stanford.edu/blog/feed.rss',
        name: 'almond blog'
    }, bob, { followRedirects: false }), '/devices');

    await assertLoginRequired(sessionRequest('/devices/delete', 'POST', { id: 'foo' }, nobody));

    //await assertHttpError(sessionRequest('/devices/delete', 'POST', { id: '' }, bob),
    //    400, 'Missing or invalid parameter id');

    await assertHttpError(sessionRequest('/devices/delete', 'POST', { id: 'com.foo' }, bob),
        404, 'Not found.');

    await sessionRequest('/devices/delete', 'POST', { id: 'org.thingpedia.rss-name:almond blog-url:https://almond.stanford.edu/blog/feed.rss' }, bob);
}

async function main() {
    const nobody = await startSession();
    const bob = await login();

    // user pages
    await testMyStuff(bob, nobody);
    await testMyDevices(bob, nobody);
}
module.exports = main;
if (!module.parent)
    main();
