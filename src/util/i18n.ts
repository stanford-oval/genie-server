// -*- mode: typescript; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2017-2020 The Board of Trustees of the Leland Stanford Junior University
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
import Gettext from 'node-gettext';
import * as gettextParser from 'gettext-parser';
import * as fs from 'fs';

export function loadTextdomainDirectory(gt : Gettext, locale : string, domain : string, modir : string) {
    assert(fs.existsSync(modir));

    const split = locale.split(/[-_.@]/);
    let mo = modir + '/' + split.join('_') + '.mo';

    while (!fs.existsSync(mo) && split.length) {
        split.pop();
        mo = modir + '/' + split.join('_') + '.mo';
    }
    if (split.length === 0) {
        console.error(`No translations found in ${domain} for locale ${locale}`);
        return;
    }
    try {
        const loaded = gettextParser.mo.parse(fs.readFileSync(mo), 'utf-8');
        gt.addTranslations(locale, domain, loaded);
    } catch(e) {
        console.log(`Failed to load translations for ${locale}/${domain}: ${e.message}`);
    }
}
