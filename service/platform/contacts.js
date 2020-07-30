// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2018 Google LLC
//           2019 The Board of Trustees of the Leland Stanford Junior University
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
"use strict";

// demo magic!
const MOCK_ADDRESS_BOOK_DATA = [
    { displayName: 'Bob', alternativeDisplayName: 'Doctor',
      isPrimary: true, starred: false, timesContacted: 0, type: 'home',
      email_address: 'elvzhang@stanford.edu', phone_number: '+1555BBOBSON',
      speakerId: 'cc52eb7a-179d-49d8-b01d-96bd3c297b5d' /* giovanni */ },
    {
      displayName: 'Ricky', alternativeDisplayName: 'Patient freaky riki rikis reekis reekes',
      isPrimary: true, starred: false, timesContacted: 0, type: 'home',
      email_address: 'elviszhang0606@gmail.com', phone_number: null,
      speakerId: 'f83882d6-795a-45f6-a9a4-6cd75731d960' /* silei */
    },
    {
      displayName: 'Alice Bobson', alternativeDisplayName: 'Mom',
      isPrimary: true, starred: true, timesContacted: 0, type: 'home',
      email_address: 'alice@bobson.com', phone_number: null,
      speakerId: 'c8fe4497-89ce-4132-86fe-e833a9d9dd15' /* monica */,
    },
    {
      displayName: 'Chris Bobson', alternativeDisplayName: 'Older Son',
      isPrimary: true, starred: false, timesContacted: 0, type: 'home',
      email_address: 'chris@bobson.com', phone_number: '+1555CBOBSON',
      speakerId: '0b46936a-033d-429b-b7d4-218c053e961c' // rakesh
    }
];

module.exports = class UserRegistry {
    constructor() {
    }

    getOwnerContact() {
        return MOCK_ADDRESS_BOOK_DATA[0];
    }

    async getAllSpeakerIds() {
        return MOCK_ADDRESS_BOOK_DATA.map((c) => c.speakerId)
            .filter((id) => id !== null);
    }

    async lookup(item, key) {
        return MOCK_ADDRESS_BOOK_DATA.map((el) => {
            const clone = {};
            Object.assign(clone, el);
            if (item === 'contact') {
                //clone.value = 'speaker:' + clone.speakerId;
                /*if (clone.phone_number !== null)
                    clone.value = 'phone:' + clone.phone_number;
                else */if (clone.email_address !== null)
                    clone.value = 'email:' + clone.email_address;
                else
                    clone.value = null;
            } else {
                clone.value = clone[item];
            }
            if (clone.value)
                return clone;
            else
                return null;
        });
    }

    async lookupPrincipal(principal) {
        return MOCK_ADDRESS_BOOK_DATA.find((contact) => {
            if (principal.startsWith('speaker:'))
                return contact.speakerId === principal.substr('speaker:'.length);
            if (principal.startsWith('phone:'))
                return contact.phone_number === principal.substr('phone:'.length);
            if (principal.startsWith('email:'))
                return contact.email_address === principal.substr('email:'.length);
            return contact;
        }) || null;
    }
};
