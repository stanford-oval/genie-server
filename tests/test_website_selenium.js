// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
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

// load thingpedia to initialize the polyfill
import 'thingpedia';
process.on('unhandledRejection', (up) => { throw up; });

import assert from 'assert';
import * as Tp from 'thingpedia';

import * as WD from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as firefox from 'selenium-webdriver/firefox';

const BASE_URL = `http://127.0.0.1:${process.env.PORT}`;

async function withSelenium(test) {
    const builder = new WD.Builder()
        .forBrowser('firefox');

    // on Travis CI we run headless; setting up Xvfb is
    // just annoying and not very useful
    if (process.env.TRAVIS) {
        builder
            .setFirefoxOptions(
                new firefox.Options().headless()
            )
            .setChromeOptions(
                new chrome.Options().headless()
            );
    }

    const driver = builder.build();
    try {
        await test(driver);
    } finally {
        driver.quit();
    }
}

const _checkedImages = new Set;

/**
 * Check that all images have URLs that return a valid image
 * (valid HTTP status and valid content-type).
 */
async function checkAllImages(driver) {
    const currentUrl = await driver.getCurrentUrl();
    const images = await driver.findElements(WD.By.css('img'));

    await Promise.all(images.map(async (img) => {
        const src = await img.getAttribute('src');

        // small optimization: we only check an image once
        // (we don't have dynamic images)
        // (we still need to use selenium to check images rather than
        // a linkchecker-style approach to make sure we catch JS-added
        // images)
        if (_checkedImages.has(src))
            return;
        _checkedImages.add(src);

        // this is not exactly what the browser does
        const res = await Tp.Helpers.Http.getStream(src, {
            extraHeaders: {
                Referrer: currentUrl
            }
        });
        assert(res.headers['content-type'].startsWith('image/'),
            `expected image/* content type for image, found ${res['content-type']}`);
        res.resume();
    }));
}

async function fillFormField(driver, selector, ...value) {
    const entry = await driver.findElement(WD.By.css(selector));
    await entry.sendKeys(...value);
}

async function login(driver) {
    await driver.wait(
        WD.until.elementLocated(WD.By.css('input[type=password][name=password]')),
        30000);

    // this would look nicer in WebTalk

    await fillFormField(driver, 'input[type=password][name=password]', '12345678');
    const submit = await driver.findElement(WD.By.css('button[type=submit]'));
    await submit.click();
}

// there is some randomness in what message we pick
const WELCOME_MESSAGES = [
    `Hi, what can I do for you?`,
    `Hi, how can I help you?`,
    `Hello, what can I do for you?`,
    `Hello, how can I help you?`,
    `Hi! What can I do for you?`,
    `Hi! How can I help you?`,
    `Hello! What can I do for you?`,
    `Hello! How can I help you?`,
];

async function testMyConversation(driver) {
    await driver.get(BASE_URL + '/');

    await login(driver);

    const inputEntry = await driver.wait(
        WD.until.elementLocated(WD.By.id('input')),
        30000);
    await checkAllImages(driver);

    // wait some extra time for the almond thread to respond
    await driver.sleep(5000);

    let messages = await driver.findElements(WD.By.css('.message'));
    // there might be more messages depending on how many notifications got processed
    // from the previous integration test
    assert(messages.length >= 1);
    assert(WELCOME_MESSAGES.includes(await messages[0].getText()));

    // todo: use a better test
    await inputEntry.sendKeys('no', WD.Key.ENTER);

    const ourInput = await driver.wait(
        WD.until.elementLocated(WD.By.css(`.message.from-user:nth-child(${messages.length + 1})`)),
        10000);
    assert.strictEqual(await ourInput.getText(), 'no');

    const response = await driver.wait(
        WD.until.elementLocated(WD.By.css(`.from-almond:nth-child(${messages.length + 2}) .message`)),
        60000);
    assert.strictEqual(await response.getText(), 'Sorry, I did not understand that. Can you rephrase it?');
}

async function main() {
    await withSelenium(testMyConversation);
}
main();
