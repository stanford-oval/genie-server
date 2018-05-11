// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Brassau
//
// Copyright 2017-2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Michael Fischer <mfischer@cs.stanford.edu>
//         Giovanni Campagna <gcampagn@cs.stanford.edu>
//         Silei Xu <silei@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('thingengine-core/lib/polyfill');

const ColorScheme = require('color-scheme');
const ThingTalk = require('thingtalk');

const ThingpediaClient = require('./thingpediaclient.js');
const ThingEngineApi = require('./thingengine');

let BACKGROUNDS;
$.holdReady(true);
$.get('https://almond.stanford.edu/brassau/backgrounds/backgrounds.json').then((data) => {
    BACKGROUNDS = data;
    $.holdReady(false);
});
let COLOR_SCHEMES;
$.holdReady(true);
$.get('https://almond.stanford.edu/brassau/backgrounds/color_schemes.json').then((data) => {
    COLOR_SCHEMES = data;
    $.holdReady(false);
});

const params = new URLSearchParams(document.location.search.substring(1));
const DISABLE_ALL_LAYOUT = params.has('layout') && params.get('layout') === 'no';
const DISABLE_ALL_BACKGROUND = params.has('background') && params.get('background') === 'no';
const RUN_TEST_CASES = params.has('test_cases') && params.get('test_cases') === 'baseline';

function toWidthHeight(box) {
    let [[x0, y0], [x1, y1]] = box;

    return {
        left: x0,
        top: y0,
        width: x1-x0,
        height: y1-y0
    };
}

function luminanace(r, g, b) {
    let a = [r, g, b].map(function (v) {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow( (v + 0.055) / 1.055, 2.4 );
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
function contrast(rgb1, rgb2) {
    let l1 = (luminanace(rgb1[0], rgb1[1], rgb1[2]) + 0.05);
    let l2 = (luminanace(rgb2[0], rgb2[1], rgb2[2]) + 0.05);
    if (l1 > l2)
        return l1/l2;
    else
        return l2/l1;
}

// copied from https://gist.github.com/mjackson/5311256
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return [ h, s, l ];
}

function colorToRGB(color) {
    let r = parseInt(color.slice(1,3), 16);
    let g = parseInt(color.slice(3,5), 16);
    let b = parseInt(color.slice(5,7), 16);
    return [r, g, b];
}

function rgbToHex(a) {
    let r = a[0];
    let g = a[1];
    let b = a[2];
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function componentToHex(c) {
    let hex = Math.round(c).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

function colorToHue(c) {
    let r, g, b;
    if (typeof c === 'string')
        [r, g, b] = colorToRGB(c);
    else
        [r, g, b] = c;
    return rgbToHsl(r, g, b)[0];
}

$(function() {
    // fake gettext for English only
    const gettext = {
        gettext: (x) => x,
        ngettext: (x, x2, n) => x === 1 ? x : x2,
        dgettext: (d, x) => x,
        dngettext: (d, x, x2, n) => x === 1 ? x : x2
    };

    function tokenize(string) {
        let tokens = string.split(/(\s+|[,."'!?])/g);
        return tokens.filter((t) => !(/^\s*$/).test(t)).map((t) => t.toLowerCase());
    }
    function escapeHTML(string) {
        if (typeof string === 'number')
            return String(string);
        if (!string)
            return '';
        string = String(string);
        const REPLACEMENTS = {
            '&': '&amp;',
            '"': '&quot;',
            '\'': '&apos;',
            '<': '&lt;',
            '>': '&gt;'
        };
        return string.replace(/[&"'<>]/g, function(what) {
            return REPLACEMENTS[what];
        });
    }

    function assignInputOutputsToBoxes(inputOutputParams, boxes) {
        let total_cost = 0;
        let available = {};
        let used = {};
        let assigned = {};
        let assignment = {};

        for (let box_label in boxes) {
            used[box_label] = 0;
            available[box_label] = boxes[box_label].length;
        }

        // separate boxes for logo and button
        if (boxes.button && boxes.button.length) {
            assignment['__action_button'] = boxes.button[0];
            used.button ++;
            available.button --;
        }
        if (boxes.logo && boxes.logo.length) {
            assignment['__logo'] = boxes.logo[0];
            used.logo ++;
            available.logo --;
        }
        if (boxes.title && boxes.title.length) {
            assignment['__title'] = boxes.title[0];
            used.title ++;
            available.title --;
        }

        function assign(from_label, to_label, cost) {
            // assign as many parameters of type "from_label" as possible
            // to a box of type "to_label"

            if (!inputOutputParams[from_label] || !available[to_label])
                return;
            let assign_offset = assigned[from_label];
            let to_assign = inputOutputParams[from_label].length - assign_offset;
            if (to_assign === 0)
                return;
            let box_offset = used[to_label];

            let assigned_this_round;

            if (available[to_label] >= to_assign) {
                // if we have enough boxes, we assign all remaining parameters of
                // this type
                assigned_this_round = to_assign;
            } else {
                // if we don't, we assign all the boxes and leave some remaining
                // parameters unassigned
                assigned_this_round = available[to_label];
            }
            used[to_label] += assigned_this_round;
            assigned[from_label] += assigned_this_round;
            total_cost += assigned_this_round * cost;
            available[to_label] -= assigned_this_round;

            for (let i = 0; i < assigned_this_round; i++) {
                let [primId, inOutParam, ] = inputOutputParams[from_label][i + assign_offset];
                assignment[primId + ':' + (inOutParam.isInputParam ? inOutParam.name : inOutParam)] = boxes[to_label][i + box_offset];
            }
        }

        for (let box_label in inputOutputParams) {
            if (available[box_label] === undefined)
                available[box_label] = 0;
            if (used[box_label] === undefined)
                used[box_label] = 0;
            assigned[box_label] = 0;

            // assign exact types at cost 0
            assign(box_label, box_label, 0);
        }

        assign('slider', 'input', 0.05);
        assign('input', 'slider', 1);
        assign('slider', 'text', 0.1);
        // try using input boxes if we run out of text boxes
        assign('text', 'input', 0.1);
        // and viceversa
        assign('input', 'text', 0.1);
        // try using image boxes for maps
        assign('map', 'image', 0.1);

        assign('switch', 'button', 0.05);
        // try using image boxes for switches
        assign('switch', 'image', 0.2);
        // try using input boxes for switches
        assign('switch', 'input', 0.3);
        // try using an image box for list
        assign('list', 'image', 0.5);
        assign('list', 'text', 2);
        assign('list', 'input', 2);
        // try using a list box for other stuff
        assign('image', 'list', 0.5);
        assign('text', 'list', 1);
        assign('input', 'list', 2);
        // try using image boxes for text
        assign('text', 'image', 1);

        const MISSING_BOX_COST = {
            'list': 10,
            'image': 10,
            'input': 1,
            'switch': 1,
            'slider': 1,
            'text': 0.5
        };

        for (let box_label in inputOutputParams) {
            let assign_offset = assigned[box_label];
            let left_over_params = inputOutputParams[box_label].length - assign_offset;

            if (left_over_params > 0) {
                for (let i = assign_offset; i < inputOutputParams[box_label].length; i++) {
                    let [, inOutParam, importance] = inputOutputParams[box_label][i];
                    let missingboxcost = MISSING_BOX_COST[box_label] || 0.1;
                    total_cost += missingboxcost + importance * 0.05;

                    // if a parameter is unspecified and required, make sure it's
                    // marked as very important, otherwise we will not put the box where
                    // it should be
                    if (inOutParam.isInputParam && inOutParam.value.isUndefined)
                        total_cost += 1000;
                }
            }
        }

        let unassigned = [];
        for (let box_label in available) {
            if (available[box_label] > 0) {
                if (box_label !== 'button')
                    total_cost += 0.1 * available[box_label];
                for (let i = used[box_label]; i < boxes[box_label].length; i++)
                    unassigned.push(boxes[box_label][i]);
            }
        }

        return [total_cost, assignment, unassigned];
    }

    function chooseBackground(prim, inputOutputParams, color_scheme) {
        let confirmation_tokens = new Set(tokenize(prim.schema.confirmation));
        for (let tag of prim.selector.kind.split(/[-._]/))
            confirmation_tokens.add(tag);
        for (let tag of prim.channel.split(/[-._]/))
            confirmation_tokens.add(tag);
        if (prim.selector.kind === 'light-bulb')
            confirmation_tokens.add('hue');
        if (prim.selector.kind === 'security-camera')
            confirmation_tokens.add('nest');
        if (prim.channel === 'source' || prim.channel === 'my_tweet')
            confirmation_tokens.add('notify');
        confirmation_tokens.delete('by');
        confirmation_tokens.delete('with');
        confirmation_tokens.delete('new');
        console.log(Array.from(confirmation_tokens));

        let first;
        let choices = [];
        let minCost = Infinity, minCostChoice;
        for (let candidate in BACKGROUNDS) {
            if (!first)
                first = candidate;
            let meta = BACKGROUNDS[candidate];
            let tags = meta.tags || [];
            let brands = meta.brands || [];
            let boxes = {};

            meta.rectangles.forEach(function(box, i) {
                let label = box.label || 'unknown';
                if (label === 'unknown') {
                    let rect = toWidthHeight(box.coordinates);
                    if (rect.height >= 3 * rect.width)
                        label = 'slider';
                     else if (box.width >= 3 * box.height)
                        label = 'text';
                     else
                        label = 'image';

                }
                if (label === 'picker')
                    label = 'input';

                if (!boxes[label])
                    boxes[label] = [];
                boxes[label].push(box);
            });

            choices.push(candidate);
            let [box_cost, assignment, empty] = assignInputOutputsToBoxes(inputOutputParams, boxes);
            let color_cost = 0.01 * Math.abs(colorToHue(meta['color-palette'][0])-colorToHue(color_scheme[0]));

            let tag_weights = 0;
            for (let tag of tags) {
                if (confirmation_tokens.has(tag))
                    tag_weights ++;
            }
            let brand_weights = 0;
            for (let tag of brands) {
                if (confirmation_tokens.has(tag))
                    brand_weights ++;
                else
                    brand_weights --;
            }

            let total_cost = box_cost + color_cost - 15 * brand_weights - 15.5 * tag_weights;
            if (total_cost < minCost) {
                minCost = total_cost;
                minCostChoice = [candidate, assignment, empty];
            }
        }
        console.log('minCost', minCost);
        return minCostChoice;
    }

    let thingpediaClient = new ThingpediaClient($('body').attr('data-developer-key'));
    let schemaRetriever = new ThingTalk.SchemaRetriever(thingpediaClient);

    class AppManager {
        constructor() {
            this._listeners = new Map;
            this._pending = new Map;

            ThingEngineApi.onmessage = this._dispatch.bind(this);
            ThingEngineApi.connect();
        }

        _dispatch(parsed) {
            console.log('received data', parsed);
            if (parsed.error) {
                alert('application error: ' + parsed.error.error);
                return;
            }

            let result = parsed.result;
            if (this._listeners.has(result.appId))
                this._listeners.get(result.appId)(result);
            else if (this._pending.has(result.appId))
                this._pending.get(result.appId).push(result);
            else
                this._pending.set(result.appId, [result]);
        }

        _flushPendingData(appId) {
            let pending = this._pending.get(appId) || [];
            let listener = this._listeners.get(appId);
            this._pending.delete(appId);
            pending.forEach(listener);
        }

        startApp(params, listener) {
            // make sure we return an A+ promise and not some weird jquery deferred
            return ThingEngineApi.createApp(params).then((result) => {
                this.addAppListener(result.uniqueId, listener);
                return result.uniqueId;
            });
        }

        stopApp(appId) {
            this._listeners.delete(appId);
            return ThingEngineApi.deleteApp(appId);
        }

        addAppListener(appId, listener) {
            this._listeners.set(appId, listener);
            this._flushPendingData(appId);
        }
    }
    let appManager = new AppManager;

    const thingpedia_icon_base_url = "https://d1ge76rambtuys.cloudfront.net/icons/";

    function describe_program(program) {
        return ThingTalk.Describe.describeProgram(gettext, program);
    }

    let $grid = $('.grid').packery({
        itemSelector: '.grid-item',
        columnWidth: 97,
        gutter: 5
    });

    function genUniqueId() {
        let id = new Uint8Array(16);
        window.crypto.getRandomValues(id);
        return Array.prototype.map.call(id, function(n) { return n.toString(16); }).join('');
    }

    class TileStorageManager {
        constructor() {
            this._store = JSON.parse(window.localStorage.getItem('stored-tiles')) || [];

            this._tileMap = new Map;
            for (let tile of this._store)
                this._tileMap.set(tile.uniqueId, tile);
        }

        getTile(id) {
            return this._tileMap.get(id);
        }
        getTiles() {
            return this._store;
        }
        deleteTile(tile) {
            this._tileMap.delete(tile.uniqueId);
            this._store = this._store.filter((el) => el !== tile);
            window.localStorage.setItem('stored-tiles', JSON.stringify(this._store));
        }

        storeTile(tile) {
            if (!this._tileMap.has(tile.uniqueId)) {
                this._tileMap.set(tile.uniqueId, tile);
                this._store.unshift(tile);
            }
            window.localStorage.setItem('stored-tiles', JSON.stringify(this._store));
        }

        clearAll() {
            this._store = [];
            this._tileMap = new Map;
            window.localStorage.setItem('stored-tiles', JSON.stringify(this._store));
        }
    }
    let tileStorageManager = new TileStorageManager();
    //tileStorageManager.clearAll();
    window.tileStorageManager = tileStorageManager;

    function isProgramComplete(program) {
        for (let [,slot] of ThingTalk.Generate.iterateSlots(program)) {
            if (slot instanceof ThingTalk.Ast.Selector) {
                if (slot.isBuiltin)
                    continue;
                if (!slot.id && !slot.principal)
                    return false;
            } else {
                if (slot.value.isUndefined)
                    return false;
            }
        }
        return true;
    }

    function* extractEntityValues(program) {
        for (let [,slot] of ThingTalk.Generate.iterateSlots(program)) {
            if (slot instanceof ThingTalk.Ast.Selector)
                continue;
            if (slot.value.isEntity)
                yield slot.value;
        }
    }

    let next_in_param_id = 0;
    let next_out_param_id = 0;

    $('#input_command').val('');
    $('#input_command').focus();

    function handleCommand(command, options) {
        options = options || {
            disableLayout: DISABLE_ALL_LAYOUT,
            disableBackground: DISABLE_ALL_LAYOUT || DISABLE_ALL_BACKGROUND
        };
        return ThingEngineApi.parseCommand(command).then(function(json) {
            if (json.error) {
                console.error('Received server error', json.error);
                alert('Sorry, that did not work: ' + json.error.message);
                $('#loader').hide();
                return Promise.resolve();
            }
            if (json.candidates.length === 0) {
                alert("Sorry, I did not understand your command. Try a different one.");
                $('#loader').hide();
                return Promise.resolve();
            }
            // drop all candidates but the best one (to save memory and disk space)
            json.candidates.length = 1;

            let tile = {
                json: json
            };
            tile.command = command;
            tile.uniqueId = genUniqueId();
            tileStorageManager.storeTile(tile);
            return createTile(tile, options).then(($item) => {
                $('#loader').hide();
                $('.grid-item.tile').addClass('grid-item--small');//.draggabilly('enable')

                expandTile($item, tile);
            });
        }).catch(function(e) {
            console.error('Error creating tile', e);
            alert('Sorry, that did not work: ' + e.message);
            $('#loader').hide();
        });
    }

    $('#input_command_form').submit(function(e) {
        e.preventDefault();
        $('#loader').show();

        console.log(1);
        let command = $("#input_command").val();
        handleCommand(command);
    });
    function expandTile($item, tile) {
        $item.removeClass('grid-item--small');//.draggabilly('disable')
        if (tile.onexpand)
            tile.onexpand();
        $grid.packery('fit', $item, 0, 0);
        $grid.packery('layout');
        $('#input_command').val(tile.json.description);
    }

    if (RUN_TEST_CASES) {
        tileStorageManager.clearAll()
        const testCases = require('./test_cases.json');

        let tiles = $('.grid-item.tile');
        function nextTestCase(i) {
            if (i === testCases.length)
                return;
            console.log('processing test case #' + (i+1) + '/' + testCases.length);

            handleCommand(testCases[i], { number: i });
            setTimeout(() => { nextTestCase(i+1); }, 1000);
        }
        nextTestCase(0);
    }

    Promise.all(tileStorageManager.getTiles().map(function (tile) {
        console.log('restoring tile ' + tile.uniqueId + ': ' + tile.json.description);
        return createTile(tile, {
            disableLayout: DISABLE_ALL_LAYOUT,
            disableBackground: DISABLE_ALL_BACKGROUND || DISABLE_ALL_LAYOUT
        });
    })).then(() => {
        $('#loader').hide();

        let tiles = $('.grid-item.tile');
        if (tiles.length === 0)
            return;
        let firstItem = $(tiles[0]);
        let tile = tileStorageManager.getTile(firstItem.attr('data-tile-id'));
        expandTile(firstItem, tile);
    }).catch((err) => {
        console.error(err.message);
        console.error(err.stack);
    });

    function createTile(data, options) {
        const candidate = data.json.candidates[0];
        const code = candidate.code;

        console.log('data', data);
        console.log('code', code);

        return ThingTalk.Grammar.parseAndTypecheck(code, schemaRetriever, true).then((program) => {
            if (program.rules.length > 1 || program.declarations.length > 0)
                throw new Error('Sorry, I cannot handle programs with more than one rule');

            let rule = program.rules[0];
            let has_trigger = false, has_action = false;
            if (rule.isRule)
                has_trigger = true;
            for (let action of rule.actions) {
                if (!action.selector.isBuiltin) {
                    has_action = true;
                    break;
                }
            }

            let display_prim;
            let display_prim_type;
            let all_prims2 = [];
            let prim_map = new Map;
            for (let [primType, prim] of ThingTalk.Generate.iteratePrimitives(program)) {
                if (prim.selector.isBuiltin)
                    continue;
                display_prim = prim;
                display_prim_type = primType;
                all_prims2.push(prim);
                prim_map.set(prim, all_prims2.length-1);
            }
            let display_prim_id = all_prims2.length-1;

            if (!display_prim || !display_prim_type)
                throw new Error('??? a program with no primitives?');

            console.log('has_trigger', has_trigger);
            console.log('has_action', has_action);

            let in_params = [];
            for (let [,slot,prim,] of ThingTalk.Generate.iterateSlots(program)) {
                if (!(slot instanceof ThingTalk.Ast.InputParam))
                    continue;
                if (slot.value.isVarRef || slot.value.isEvent)
                    continue;
                in_params.push([prim_map.get(prim), slot]);
            }
            //let out_params = display_prim.out_params;
            let out_param_types = rule.stream ? rule.stream.schema.out :
                rule.table ? rule.table.schema.out : {};
            let out_params2 = Object.keys(out_param_types);

            function makeTitle(prim) {
                let title = prim.schema.canonical;
                title = title.split(' ');
                let onIndex = title.indexOf('on');
                if (onIndex > 0)
                    title = title.slice(0, onIndex);
                title = title.join(' ');
                return title;
            }
            let title = all_prims2.map(makeTitle).join(' then ');
            let display_title = makeTitle(display_prim);
            let first_two_words = display_title.split(' ').slice(0, 1).join(' ');

            function getIconKind(prim, primId) {
                let device_choices = candidate.devices[`p_${primId}`];
                // if (!Array.isArray(device_choices))
                //     throw new Error('Must configure at least one device of kind ' + device_choices.kind)
                let device = device_choices[0];
                let device_kind = device ? device.kind : prim.selector.kind;
                if (device_kind.indexOf('.') < 0) {
                    switch (device_kind) {
                    case 'activity-tracker':
                    case 'fitness-tracker':
                        device_kind = 'com.jawbone.up';
                        break;
                    case 'tumblr-blog':
                        device_kind = 'com.tumblr';
                        break;
                    case 'security-camera':
                    case 'thermostat':
                        device_kind = 'com.nest';
                        break;
                    case 'light-bulb':
                        device_kind = 'com.hue';
                        break;
                    case 'car':
                        device_kind = 'com.tesla';
                        break;
                    default:
                        device_kind = 'org.thingpedia.builtin.thingengine.builtin';
                    }
                }
                return device_kind;
            }
            function getIcon(prim, primId) {
                return thingpedia_icon_base_url + getIconKind(prim, primId) + ".png";
            }
            let device_icons = all_prims2.map(getIcon);

            let color_scheme = COLOR_SCHEMES[getIconKind(display_prim, all_prims2.length-1)];
            if (!color_scheme)
                color_scheme = COLOR_SCHEMES['org.thingpedia.builtin.thingengine.builtin'];
            let colors_dominant = color_scheme.colors_dominant;

            // tiles are created small by default, the /command code will remove grid-item--small as appropriate
            let a = `<div class="grid-item grid-item--small tile ${options.disableLayout ? 'layoutless' : ''}" >`;

            let entities = Array.from(extractEntityValues(program));
            function entityHasLogo(entityType) {
                return entityType.startsWith('sportradar:') || entityType === 'tt:stock_id' || entityType === 'tt:iso_lang_code';
            }
            function entityIsContact(entityType) {
                return entityType === 'tt:contact' || entityType === 'tt:phone_number' || entityType === 'tt:contact_name';
            }

            let logoEntities = entities.filter((e) => entityHasLogo(e.type) || entityIsContact(e.type));

            if (logoEntities.length > 0) {
                let firstEntity = logoEntities[0];
                a += `<img src="https://thingpedia.stanford.edu/thingpedia/api/entities/icon?entity_type=${firstEntity.type}&entity_value=${encodeURIComponent(firstEntity.value)}&entity_display=${encodeURIComponent(firstEntity.display || '')}" class="program-icon">`;                }

            a+=`<div class="program-logo">`;
            device_icons.forEach(function(device_icon) {
                a +=`<img src=${device_icon}>`;
            });
            a+=`</div>`;

            let is_list = false;
            // FIXME use info in thingpedia to decide
            // for now, bad heuristic: if a numeric out parameter is present,
            // we assume it's a replace when
            if (has_trigger) {
                is_list = !out_params2.some(function(o) {
                    let ptype = out_param_types[o];
                    return ptype.isNumber || ptype.isMeasure;
                });

                // except nope, github is always append
                if (display_prim.selector.kind === 'com.github')
                    is_list = true;
                // and security camera is always replace
                if (display_prim.selector.kind === 'security-camera')
                    is_list = false;
                // and phone.gps is replace
                if (display_prim.selector.kind === 'org.thingpedia.builtin.thingengine.phone' &&
                    display_prim.channel === 'gps')
                    is_list = false;
            } else if (display_prim_type === 'table') {
                let has_count = false;
                display_prim.in_params.forEach(function(in_param) {
                    if (in_param.name === 'count')
                        has_count = true;

                });
                if (display_prim.schema.canonical.startsWith('list') ||
                    display_prim.schema.canonical.startsWith('search'))
                    is_list = true;
                if (['com.uber', 'com.nytimes', 'com.washingtonpost', 'com.wsj'].indexOf(display_prim.selector.kind) >= 0)
                    is_list = true;
                if (['org.thingpedia.holidays'].indexOf(display_prim.selector.kind) >= 0)
                    is_list = false;
                if (has_count)
                    is_list = true;
                for (let prim of all_prims2) {
                    if (prim.schema.is_list)
                        is_list = true;
                }

                /*let has_count_param = !!(display_prim.schema.inReq['count'] || display_prim.schema.inOpt['count'])
                if (has_count_param && !has_count) {
                    display_prim.in_params.push(ThingTalk.Ast.InputParam('count', ThingTalk.Ast.Value.Number(1)))
                    is_list = false
                }*/
            }
            console.log('is_list', is_list);
            if (has_trigger || is_list) {
                if (is_list) {
                    a += `<span class="program-notification-badge">
                    <span class="program-notification-count"></span>
                    <span class="sr-only">new notifications present</span>
                    </span>`;
                } else {
                    a += `<span class="program-notification-badge no-count">
                    <span class="sr-only">new data present</span>
                    </span>`;
                }
            }
            let has_link = out_params2.length > 1 &&
                out_param_types.link && out_param_types.link.isEntity &&
                out_param_types.link.type === 'tt:url';
            let has_alt_text = out_param_types.alt_text && out_param_types.alt_text.isString;

            let in_param_map = {};
            let in_param_types = {};
            let num_entities_or_constants = 0;
            let num_non_constant = 0;
            const HARDCODED_INPUT_PARAM_TYPES = {
                'count': 'hidden',
                'status': 'textarea',
                'message': 'textarea',
                'text': 'textarea',
                'body': 'textarea',
                'contents': 'textarea',
                'issue_number': 'text'
            };
            const INPUT_PARAM_TYPES_BY_TT_TYPES = {
                'String': 'text',
                'Number': 'slider',
                'Enum(on,off)': 'on-off-switch',
                'Boolean': 'bool-switch',
                'Location': 'location',
                'Entity(imgflip:meme_id)': 'entity-dropdown',
                'Entity(tt:picture)': 'file',
                'Entity(tt:username)': 'text',
                'Entity(tt:hashtag)': 'text'
            };

            let display_in_params = [];
            in_params.forEach(function([primId, in_param]) {
                let prim = all_prims2[primId];

                let tt_type = prim.schema.inReq[in_param.name] || prim.schema.inOpt[in_param.name];
                let display_type = HARDCODED_INPUT_PARAM_TYPES[in_param.name];
                if (!display_type)
                    display_type = INPUT_PARAM_TYPES_BY_TT_TYPES[String(tt_type)];
                if (!display_type) {
                    if (tt_type.isEntity && entityHasLogo(tt_type.type)) {
                        if (!in_param.value.isUndefined)
                            display_type = 'entity';
                        else
                            display_type = 'entity-dropdown';
                    } else if (tt_type.isEntity && (tt_type.type === 'tt:phone_number' || tt_type.type === 'tt:email_address')) {
                        if (!in_param.value.isUndefined)
                            display_type = 'entity';
                        else
                            display_type = 'text';
                    } else if (tt_type.isEnum && tt_type.entries.length <= 3) {
                        display_type = 'radio';
                    } else if (tt_type.isEnum) {
                        display_type = 'drop-down';
                    } else if (tt_type.isMeasure) {
                        display_type = 'slider';
                    }
                }
                if (!display_type) {
                    if (in_param.value.isUndefined)
                        display_type = 'text';
                    else
                        display_type = 'constant';
                }
                in_param_types[primId + ':' + in_param.name] = display_type;

                if (display_type === 'hidden')
                    return;

                if (display_type === 'entity' || display_type === 'constant')
                    num_entities_or_constants ++;
                else
                    num_non_constant ++;

                if (display_type !== 'constant')
                    display_in_params.push([primId, in_param]);
            });

            const INPUT_PARAM_IMPORTANCE_BY_DISPLAY_TYPE = {
                'location': 20,
                'textarea': 10,
                'entity-dropdown': 15,
                'slider': 5,
                'on-off-switch': 5,
                //'radio': 1,
                'entity': 2,
                'constant': 1
            };
            const INPUT_PARAM_IMPORTANCE_BY_TT_TYPE = {
                'String': 15,
                'Enum': 15,
                'Measure': 8,
                'Number': 1,
                'Entity(sportradar:eu_soccer_team)': -20,
                'Entity(sportradar:us_soccer_team)': -20,
                'Entity(sportradar:nba_team)': -20,
                'Entity(sportradar:mlb_team)': -20,
                'Entity(sportradar:ncaafb_team)': -20,
                'Entity(sportradar:ncaambb_team)': -20,
            };
            function computeInputParamImportance(primId, in_param) {
                let prim = all_prims2[primId];
                let display_type = in_param_types[primId + ':' + in_param.name];
                let tt_type = prim.schema.inReq[in_param.name] || prim.schema.inOpt[in_param.name];

                let display_weight = INPUT_PARAM_IMPORTANCE_BY_DISPLAY_TYPE[display_type] || 0;
                let tt_weight;
                if (tt_type.isEnum)
                    tt_weight = INPUT_PARAM_IMPORTANCE_BY_TT_TYPE.Enum;
                else if (tt_type.isMeasure)
                    tt_weight = INPUT_PARAM_IMPORTANCE_BY_TT_TYPE.Measure;
                else
                    tt_weight = INPUT_PARAM_IMPORTANCE_BY_TT_TYPE[String(tt_type)] || 0;
                return display_weight + tt_weight;
            }

            const DEFAULT_OUTPUT_PARAM = {
                display: value => value.display || value,
                show: false
            };
            const OUTPUT_PARAM_BY_TYPES = {
                'String': {
                    display: value => `${escapeHTML(value)}`,
                    show: true,
                },
                'Measure(C)': {
                    display: value => `${value.toFixed(1)} C`,
                    show: true,
                },
                'Measure(mps)': {
                    display: value => `${value.toFixed(1)} m/s`,
                    show: true,
                },
                'Measure(byte)': {
                    display: value => `${(value /1024/1024).toFixed(2)} MB`,
                    show: true,
                },
                'Measure(kg)': {
                    display: value => `${value.toFixed(1)} kg`,
                    show: true,
                },
                'Measure(ms)': {
                    display: value => `${(value /60000).toFixed(0)} minutes`,
                    show: true,
                },
                'Measure(m)': {
                    display: value => {
                        let unit = 'm';
                        if (value >= 0.1 * 1.496e+11) {
                            // NASA astronomic distances
                            value /= 1.496e+11;
                            unit = 'au';
                        } else if (value >= 1000) {
                            value /= 1000;
                            unit = 'km';
                        } else if (value <= 0.5) {
                            value *= 100;
                            unit = 'cm';
                        }
                        return `${value.toFixed(2)} ${unit}`;
                    },
                    show: true,
                },
                'Number': {
                    display: value => {
                        value = Number(value || 0);
                        if (Math.floor(value) === value)
                            return String(value);
                        else
                            return value.toFixed(2);
                    },
                    show: true,
                },
                'Date': {
                    display: value => `${new Date(value).toLocaleString()}`,
                    show: true
                },
                'Entity(tt:email_address)': {
                    display: value => {
                        return `<a href="mailto:${escapeHTML(value.value || value)}" target="_blank">${escapeHTML(value.display || value.value || value)}</a>`;
                    },
                    show: true
                },
                'Entity(tt:phone_number)': {
                    display: value => {
                        return `<a href="tel:${escapeHTML(value.value || value)}" target="_blank">${escapeHTML(value.display || value.value || value)}</a>`;
                    },
                    show: true
                },
                'Entity(tt:picture)': {
                    display: value => {
                        if (!value)
                            return '';
                        if (has_link)
                            return `<img src="${escapeHTML(value.value || value)}">`;
                        else
                            return `<a href="${escapeHTML(value.value || value)}" target="_blank"><img src="${escapeHTML(value.value || value)}"></a>`;
                    },
                    show: true,
                },
                'Entity(tt:username)': {
                    display: value => `@${escapeHTML(value.value || value)}`,
                    show: true,
                },
                'Entity(tt:url)': {
                    display: value => `<a href="${value.value || value}">${value.display || value.value || value}</a>`,
                    show: true,
                },
                'Array(Entity(tt:hashtag))': {
                    display: value => `${escapeHTML(value.map((v) => '#' + (v.value || v)).join(' '))}`,
                    show: true,
                },
                'Array(Entity(tt:url))': {
                    display: value => `${value.map((v) => '<a href="' + escapeHTML(v.value || v) + '">' + escapeHTML(v.value || v)
                     + '</a>').join(' ')}`,
                    show: true,
                }
            };
            function makeEntityDisplay(entityType) {
                return function(value) {
                    return `<img src="https://thingpedia.stanford.edu/thingpedia/api/entities/icon?entity_type=${entityType}&entity_value=${encodeURIComponent(value.value || value)}&entity_display=${encodeURIComponent(value.display || '')}" style="width:32px; height:32px; object-fit: contain; margin-right:6px">${escapeHTML(value.display || value.value || value)}`;
                };
            }
            function makeEnumDisplay(enumType) {
                return function(value) {
                    return String(value).replace(/_/g, ' ');
                };
            }

            const MORE_HARDCODED_OUTPUT_PARAMS = {
                'org.thingpedia.builtin.thingengine.builtin:get_time:time': {
                    display: value => `${new Date(value).toLocaleTimeString()}`,
                    show: true
                },
                'org.thingpedia.builtin.thingengine.builtin:get_date:date': {
                    display: value => `${new Date(value).toLocaleDateString()}`,
                    show: true
                },
                'com.imgflip:generate:name': {
                    display: value => null,
                    show: false
                }
            };

            const HARDCODED_OUTPUT_PARAMS = {
                hashtags: {
                    show: false,
                },
                urls: {
                    show: false
                },
                in_reply_to: {
                    display: value => {
                        if (!value)
                            return '';
                        else
                            return `re: @${escapeHTML(value.value || value)}`;
                    },
                    show: true,
                },
                video_id: {
                    display: value => `<iframe title="YouTube video player" class="youtube-player" type="text/html"
width="100%" src="http://www.youtube.com/embed/${escapeHTML(value.value || value)}"
frameborder="0" allowFullScreen></iframe>`,
                    show: true,
                },
                channel_id: {
                    display: value => `<a href="http://www.youtube.com/channel/${escapeHTML(value)}" target="_blank">Go To Channel</a>`,//"
                    show: true
                },
                link: {
                    display: value => `<a href="${escapeHTML(value.value || value)}">${escapeHTML(value.display || value.value || value)}</a>`,
                    show: !has_link
                },
                low_estimate: {
                    display: value => `${escapeHTML(value)} $`,
                    show: true
                },
                company_name: {
                    display: value => null,
                    show: false
                },
                image_id: {
                    display: value => null,
                    show: false
                },
                from_name: {
                    display: value => null,
                    show: false
                },
                surge: {
                    display: value => null,
                    show: false
                },
                currency_code: {
                    display: value => null,
                    show: false
                },
                asteroid_id: {
                    display: value => null,
                    show: false
                },
                orbiting_body: {
                    display: value => null,
                    show: false
                }
            };

            /*const HARDCODED_SHOW_LABEL = {
                title: 'no',
                translated_text: 'no',
                text: 'no'
            };
            const SHOW_LABEL_BY_TYPES = {
                'Entity(tt:picture)': 'no',
                'Entity': 'no',
                'Number': 'after',
                'Measure': 'after',
                'String': 'before',
            };
            function shouldShowLabel(out_param) {
                let pname = out_param.value
                let ptype = display_prim.schema.out[pname]
                if (pname in HARDCODED_SHOW_LABEL)
                    return HARDCODED_SHOW_LABEL[pname]
                let tt_type = String(ptype)
                if (tt_type in SHOW_LABEL_BY_TYPES)
                    return SHOW_LABEL_BY_TYPES[tt_type]
                if (ptype.isEntity)
                    return SHOW_LABEL_BY_TYPES.Entity
                if (ptype.isMeasure)
                    return SHOW_LABEL_BY_TYPES.Measure
                return 'before'
            }*/
            function shouldShowLabel(out_param) {
                return 'no';
            }

            let display_out_params = [];
            out_params2.forEach(function(out_param) {
                let ptype = out_param_types[out_param];

                let key = display_prim.selector.kind + ':' + display_prim.channel + ':' + out_param;
                let format = MORE_HARDCODED_OUTPUT_PARAMS[key] || HARDCODED_OUTPUT_PARAMS[out_param] || OUTPUT_PARAM_BY_TYPES[String(ptype)];
                if (!format && ptype.isEntity) {
                    format = OUTPUT_PARAM_BY_TYPES[String(ptype)] = {
                        display: makeEntityDisplay(ptype.type),
                        show: true
                    };
                }
                if (!format && ptype.isEnum) {
                    format = OUTPUT_PARAM_BY_TYPES[String(ptype)] = {
                        display: makeEnumDisplay(ptype),
                        show: true
                    };
                }
                if (!format)
                    format = DEFAULT_OUTPUT_PARAM;
                if (!format.show)
                    return;
                /*if (display_prim_type === 'trigger' && out_param === 'time')
                    return;*/
                display_out_params.push([display_prim_id, out_param]);
            });

            const HARDCODED_OUTPUT_PARAM_IMPORTANCE = {
                video_id: 50,
                name: 12,
                uber_type: 11.6,
                low_estimate: 11.5,
                description: 9.9,
                translated_text: 10.5,
                // String: 10
                from: 9.5,
                in_reply_to: 9
            };
            const OUTPUT_PARAM_IMPORTANCE_BY_TYPE = {
                'Entity(tt:picture)': 20,
                'Entity(tt:email_address)': 12,
                'Entity(tt:phone_number)': 12,
                'Entity': 11.5,
                'Measure': 11,
                'String': 10,
                'Date': 9,
                'Location': 5,
                'Number': 5,
                'Array': -15,
                'Entity(sportradar:eu_soccer_team)': -20,
                'Entity(sportradar:us_soccer_team)': -20,
                'Entity(sportradar:nba_team)': -20,
                'Entity(sportradar:mlb_team)': -20,
                'Entity(sportradar:ncaafb_team)': -20,
                'Entity(sportradar:ncaambb_team)': -20,
                'Entity(instagram:media_id)': -20
                // everything else is 0
            };

            function computeOutputParamImportance(pname) {
                if (HARDCODED_OUTPUT_PARAM_IMPORTANCE[pname])
                    return HARDCODED_OUTPUT_PARAM_IMPORTANCE[pname];
                let ptype = out_param_types[pname];

                let importance = OUTPUT_PARAM_IMPORTANCE_BY_TYPE[String(ptype)];
                if (importance)
                    return importance;
                if (ptype.isArray)
                    return OUTPUT_PARAM_IMPORTANCE_BY_TYPE.Array;
                if (ptype.isEntity)
                    return OUTPUT_PARAM_IMPORTANCE_BY_TYPE.Entity;
                if (ptype.isMeasure)
                    return OUTPUT_PARAM_IMPORTANCE_BY_TYPE.Measure;
                return 0;
            }

            const BOX_LABEL_BY_INPUT_PARAM_TYPE = {
                'text': 'input',
                'slider': 'slider',
                'on-off-switch': 'switch',
                'bool-switch': 'switch',
                'entity': 'text',
                'constant': 'text',
                'entity-dropdown': 'input',
                'drop-down': 'input',
                'textarea': 'input',
                'file': 'input',
                'location': 'map',
                'radio': 'input'
            };

            let inputOutputParams = display_in_params.concat(display_out_params);
            let inputOutputImportance = {};
            inputOutputParams.forEach(function([primId, inOutParam]) {
                let importance, box_label;
                if (inOutParam.isInputParam) {
                    importance = computeInputParamImportance(primId, inOutParam);
                    let display_type = in_param_types[primId + ':' + inOutParam.name];
                    if (!display_type)
                        throw new Error('???');
                    box_label = BOX_LABEL_BY_INPUT_PARAM_TYPE[display_type] || 'input';
                } else {
                    // output parameters get 4.9 extra points just for being outputs
                    importance = 4.9 + computeOutputParamImportance(inOutParam);
                    let tt_type = out_param_types[inOutParam];
                    box_label;
                    if ((tt_type.isEntity && tt_type.type === 'tt:picture') || inOutParam.value === 'video_id')
                        box_label = 'image';
                    else
                        box_label = 'text';
                }
                if (!inputOutputImportance[box_label])
                    inputOutputImportance[box_label] = [];
                if (importance < 0 && !(inOutParam.isInputParam && inOutParam.value.isUndefined))
                    return;

                inputOutputImportance[box_label].push([primId, inOutParam, importance]);
            });
            console.log('importance', inputOutputImportance);
            for (let box_label in inputOutputImportance) {
                inputOutputImportance[box_label].sort(function(a, b) {
                    let [aPrimId, aInOutParam, aImportance] = a;
                    let [bPrimId, bInOutParam, bImportance] = b;
                    if (bImportance === aImportance) {
                        let primOrder = aPrimId - bPrimId;
                        if (primOrder === 0) {
                            let aIndex = all_prims2[aPrimId].schema.index[aInOutParam.isInputParam ? aInOutParam.name : aInOutParam];
                            let bIndex = all_prims2[bPrimId].schema.index[bInOutParam.isInputParam ? bInOutParam.name : bInOutParam];
                            return aIndex - bIndex;
                        } else {
                            return primOrder;
                        }
                    } else {
                        return bImportance - aImportance;
                    }
                });
            }

            let background_image, inputOutputAssignment, emptyBoxes;
            if (data.background_image) {
                background_image = data.background_image;
                if (data.input_output_assignment)
                    inputOutputAssignment = data.input_output_assignment;
                else
                    inputOutputAssignment = {};
                if (data.empty_boxes)
                    emptyBoxes = data.empty_boxes;
                else
                    emptyBoxes = [];
            } else {
                [background_image, inputOutputAssignment, emptyBoxes] = chooseBackground(display_prim, inputOutputImportance, colors_dominant);
            }
            console.log('background_image', background_image);
            console.log('inputOutputAssignment', inputOutputAssignment);
            console.log('emptyBoxes', emptyBoxes);
            data.background_image = background_image;
            data.input_output_assignment = inputOutputAssignment;
            data.empty_boxes = emptyBoxes;

            let backgroundMeta = BACKGROUNDS[background_image];
            if (!backgroundMeta) {
                backgroundMeta = {
                    rectangles: [],
                    'dominant-colors': [
                        [0, 0, 0]
                    ],
                    'color-palette': [],
                    'corner-colors': {
                        'top-right': [255, 255, 255],
                        'bottom-right': [255, 255, 255],
                        'top-left': [255, 255, 255]
                    }
                };
            }

            let input_rects = [];
            let output_rects = [];
            display_in_params = display_in_params.filter(function([primId, in_param]) {
                return !!inputOutputAssignment[primId + ':' + in_param.name];
            });
            input_rects = display_in_params.map(function([primId, in_param]) {
                return inputOutputAssignment[primId + ':' + in_param.name];
            });
            display_out_params = display_out_params.filter(function([primId, out_param]) {
                return !!inputOutputAssignment[primId + ':' + out_param];
            });
            output_rects = display_out_params.map(function([primId, out_param]) {
                return inputOutputAssignment[primId + ':' + out_param];
            });

            console.log('input_rects', input_rects);
            console.log('output_rects', output_rects);

            function chooseForegroundColor(background_color) {
                if(!background_color) {
                    console.error('ERROR: missing color in rectangle');
                    return 'black';
                }
                let maxContrast = 0;
                let color_candidate;
                for (let color of backgroundMeta['color-palette']) {
                    let a = contrast(background_color, color);
                    if (a > maxContrast) {
                        color_candidate = color;
                        maxContrast = a;
                    }
                }
                if (maxContrast < 2.5) {
                    if (background_color[0] >= 253 && background_color[1] >= 253 &&
                        background_color[2] >= 253)
                        return '#565656';

                    console.log(`no contrasting colors found for ${color_candidate}`);
                    let scheme = new ColorScheme();
                    let colors = scheme.from_hex(rgbToHex(background_color).substr(1))
                        .scheme('contrast')
                        .colors()
                        .map(color => "#" + color);
                    console.log('fallback to color scheme from ' + rgbToHex(background_color), colors);
                    return colors[1];
                }

                return rgbToHex(color_candidate);
            }
            let input_colors = data.input_colors || input_rects.map(function(rect) {
                return rect['font-color'] || chooseForegroundColor(rect['left-color']);
            });
            data.input_colors = input_colors;

            let output_colors = data.output_colors || output_rects.map(function(rect) {
                return rect['font-color'] || chooseForegroundColor(rect['left-color']);
            });
            data.output_colors = output_colors;

            let close_button_color = data.close_button_color || chooseForegroundColor(backgroundMeta['corner-colors']['top-right']);
            data.close_button_color = close_button_color;
            a += `<button type="button" class="close" style="color:${close_button_color}; -webkit-text-stroke: unset; text-shadow:unset;">
                <span style='font-size:1.3em'>&times;</span>
            </button>`;

            let action_button_color;
            if (inputOutputAssignment['__action_button']) {
                if (data.action_button_color)
                    action_button_color = data.action_button_color;
                else if (inputOutputAssignment['__action_button']['font-color'])
                    action_button_color = inputOutputAssignment['__action_button']['font-color'];
                else
                    action_button_color = chooseForegroundColor(inputOutputAssignment['__action_button']['left-color']);
            } else {
                action_button_color = data.action_button_color || chooseForegroundColor(backgroundMeta['corner-colors']['bottom-right']);
            }
            data.action_button_color = action_button_color;

            let title_color;
            if (inputOutputAssignment['__title']) {
                if (data.title_color)
                    title_color = data.title_color;
                else if (inputOutputAssignment['__title']['font-color'])
                    title_color = inputOutputAssignment['__title']['font-color'];
                else
                    title_color = chooseForegroundColor(inputOutputAssignment['__title']['left-color']);
            } else {
                title_color = data.title_color || chooseForegroundColor(backgroundMeta['corner-colors']['top']);
            }
            data.title_color = title_color;

            a+=`<div class='palettes'>`;
            if (options.number !== undefined)
                data.testCaseNumber = options.number;
            if (data.testCaseNumber !== undefined)
                a +=`<div class='test-case-number'>${data.testCaseNumber}</div>`;
            a += `</div>`;

            display_in_params.forEach(function([primId, in_param]) {
                let prim = all_prims2[primId];
                let display_type = in_param_types[primId + ':' + in_param.name];
                if (!display_type)
                    throw new Error('???');
                //let label = in_param.name.replace(/_/g, ' ');
                let tt_type = prim.schema.inReq[in_param.name] || prim.schema.inOpt[in_param.name];

                let in_param_id = next_in_param_id++;
                in_param_map[in_param_id] = {
                    prim_id: primId,
                    in_param: in_param,
                    in_param_type: display_type,
                    in_param_tt_type: tt_type,
                    onchange: null
                };

                a+=`<div id='parent-input-${in_param_id}' class="program-input-group">`;

                let should_label = false;
                if (display_type === 'entity' || display_type === 'constant')
                    should_label = num_entities_or_constants > 1;
                else if (display_type !== 'text' && display_type !== 'file' && display_type !== 'textarea' &&
                        display_type !== 'radio' && display_type !== 'drop-down' && display_type !== 'entity-dropdown')
                    should_label = num_non_constant > 1;
                if (should_label)
                    a+=`<div id="input-${in_param_id}-label">${in_param.name.replace(/_/g, ' ')}</div>`;

                switch(display_type) {
                    case 'entity-dropdown':
                        a += `<div class="input-group">`;
                        if (primId !== display_prim_id)
                            a += `<span class="input-group-addon"><img src="${thingpedia_icon_base_url + prim.selector.kind}.png" style="width:24px;max-height:24px"></span>`;
                        a += `<select id="input-${in_param_id}" class="program-input form-control drop-down entity-drop-down" data-entity-type="${tt_type.type}" size=1></select>`;
                        a += `</div>`;
                        in_param_map[in_param_id].onchange = function(element, event) {
                            let $el = $(element);
                            let opt = $('option[value=' + element.value + ']', $el);
                            this.in_param.value = ThingTalk.Ast.Value.Entity(element.value, tt_type.type, opt.text().trim());
                        };
                        break;

                    case 'radio':
                        a += `<div class="program-radio-input" id="input-${in_param_id}">`;
                        for (let entry of tt_type.entries)
                            a += `<label><input type="radio" name="input-${in_param_id}" id="input-${in_param_id}-${entry}" class="program-input checkbox" value="${entry}" ${in_param.value.value === entry ? 'checked' : ''}>${entry.replace(/_/g, ' ')}</label>`;
                        in_param_map[in_param_id].onchange = function(element, event) {
                            this.in_param.value = ThingTalk.Ast.Value.Enum(element.value);
                        };
                        a += `</div>`;
                        break;

                    case 'drop-down':
                        a += `<div class="input-group">`;
                        if (primId !== display_prim_id)
                            a += `<span class="input-group-addon"><img src="${thingpedia_icon_base_url + prim.selector.kind}.png" style="width:24px;max-height:24px"></span>`;
                        a += `<select id="input-${in_param_id}" class="program-input form-control drop-down" size=1>`;
                        for (let entry of tt_type.entries)
                            a += `<option value="${entry}" ${in_param.value.value === entry ? 'selected' : ''}>${entry.replace(/_/g, ' ')}</option>`;
                        a += `</select>`;
                        a += `</div>`;
                        in_param_map[in_param_id].onchange = function(element, event) {
                            this.in_param.value = ThingTalk.Ast.Value.Enum(element.value);
                        };
                        break;

                    case 'entity':
                        a += `<span id="input-${in_param_id}" class="program-input program-constant-input">
                            <img src="https://thingpedia.stanford.edu/thingpedia/api/entities/icon?entity_type=${in_param.value.type}&entity_value=${encodeURIComponent(in_param.value.value)}&entity_display=${encodeURIComponent(in_param.value.display || '')}" style="width:32px; height:32px; object-fit: contain; margin-right:6px">${in_param.value.display || in_param.value.value /*"*/}
                            </span>`;
                        break;

                    case "constant":
                        a += `<span id="input-${in_param_id}" class="program-input program-constant-input">${in_param.value.isMeasure ? in_param.value.value + ' ' + in_param.value.unit : in_param.value.toJS()}</span>`;
                        break;

                    case "slider": {
                        let slider_max, slider_min;
                        if (prim.channel === 'get_comic') {
                            slider_max = 1890;
                            slider_min = 1;
                        } else if (in_param.name === 'percent') {
                            slider_max = 100;
                            slider_min = 0;
                        } else if (in_param.name === 'count') {
                            slider_min = 1;
                            slider_max = 10;
                        } else if (tt_type.unit === 'C' && in_param.value.unit === 'F') {
                            slider_min = 50;
                            slider_max = 110;
                        } else if (tt_type.unit === 'C') {
                            slider_min = -5;
                            slider_max = 30;
                        } else {
                            slider_min = 0;
                            slider_max = 20;
                        }
                        console.log('value', in_param.value.value);
                        a += `<input id="input-${in_param_id}"
                            class="program-input slider ${in_param.value.isUndefined ? 'incomplete' : ''}"
                            type="text"
                            data-slider-min="${slider_min}"
                            data-slider-max="${slider_max}"
                            data-slider-step="1"
                            data-slider-reversed="${tt_type.unit === 'C'}"
                            data-slider-value="${in_param.value.isUndefined ? slider_min : in_param.value.value}"
                            value="${in_param.value.isUndefined ? slider_min : in_param.value.value}"/>`;
                        in_param_map[in_param_id].onchange = function(element, event) {
                            if (tt_type.isNumber)
                                this.in_param.value = ThingTalk.Ast.Value.Number(parseFloat(element.value));
                            else
                                this.in_param.value = ThingTalk.Ast.Value.Measure(parseFloat(element.value), this.in_param.value.unit || tt_type.unit);
                        };
                        break;
                    }

                    case "on-off-switch":
                        a += `<input id="input-${in_param_id}" type="checkbox" data-size='' class="program-input checkbox-switch ${in_param.value.isUndefined ? 'incomplete' : ''}" ${in_param.value.value === 'on' ? 'checked' :''} >`;
                        in_param_map[in_param_id].onchange = function(element, event, state) {
                            this.in_param.value = ThingTalk.Ast.Value.Enum(state ? 'on' : 'off');
                        };
                        break;

                    case 'bool-switch':
                        a += `<input id="input-${in_param_id}" type="checkbox" class="program-input checkbox-switch ${in_param.value.isUndefined ? 'incomplete' : ''}" ${in_param.value.value === true ? 'checked' :''}>`;
                        in_param_map[in_param_id].onchange = function(element, event, state) {
                            this.in_param.value = ThingTalk.Ast.Value.Boolean(!!state);
                        };
                        break;

                    case "text":
                        a += `<div class="input-group">`;
                        if (primId !== display_prim_id)
                            a += `<span class="input-group-addon"><img src="${thingpedia_icon_base_url + prim.selector.kind}.png" style="width:24px;max-height:24px"></span>`;
                        if (tt_type.isEntity && tt_type.type === 'tt:username')
                            a += `<span class="input-group-addon">@</span>`;
                        else if (tt_type.isEntity && tt_type.type === 'tt:hashtag')
                            a += `<span class="input-group-addon">#</span>`;
                        a += `<input id="input-${in_param_id}" type="text" placeholder="${in_param.name.replace(/_/g, ' ')}" class="program-input form-control ${in_param.value.isUndefined ? 'incomplete' : ''}" value="${escapeHTML(in_param.value.value || '')}" >`;//"
                        if (tt_type.isMeasure)
                            a += `<span class="input-group-addon">${in_param.value.unit || tt_type.unit}</span>`;
                        a += `</div>`;
                        in_param_map[in_param_id].onchange = function(element, event) {
                            let in_param = this.in_param;
                            let tt_type = prim.schema.inReq[in_param.name] || prim.schema.inOpt[in_param.name];
                            if (tt_type.isNumber)
                                this.in_param.value = ThingTalk.Ast.Value.Number(parseFloat(element.value));
                            else if (tt_type.isMeasure)
                                this.in_param.value = ThingTalk.Ast.Value.Measure(parseFloat(element.value), this.in_param.value.unit || tt_type.unit);
                            else
                                this.in_param.value = ThingTalk.Ast.Value.fromJS(tt_type, element.value);
                        };
                        break;

                    case "file":
                        // a += `<input id="input-${in_param_id}" type="file" placeholder="${in_param.name.replace(/_/g, ' ')}" class="program-input form-control ${in_param.value.isUndefined ? 'incomplete' : ''}" value="${in_param.value.value || ''}" >`
                        // in_param_map[in_param_id].onchange = function(element, event) {
                        //     alert('Sorry, uploading files is not implemented yet...')
                        // }
                        a += `<i id="input-${in_param_id}" class="program-input fa fa-cloud-upload" ></i>`;
                        break;

                    case "textarea":
                        a += `<textarea id="input-${in_param_id}" placeholder="${in_param.name.replace(/_/g, ' ')}" class="program-input form-control ${in_param.value.isUndefined ? 'incomplete' : ''}" rows="5" >${escapeHTML(in_param.value.value || '')}</textarea>`;//"
                        in_param_map[in_param_id].onchange = function(element, event) {
                            this.in_param.value = ThingTalk.Ast.Value.String(element.value);
                        };
                        break;

                    case 'location':
                        if (in_param.value.isUndefined)
                            {a += `<div id="input-${in_param_id}" class="program-input location-widget incomplete" data-lat="57.7408248"
                                data-lng="12.9392933"></div>`;}
                        else if (in_param.value.value.isRelative)
                            {a += `<div id="input-${in_param_id}" class="program-input location-widget" data-lat="37.4299195"
                                data-lng="-122.173239"></div>`;}
                        else
                            {a += `<div id="input-${in_param_id}" class="program-input location-widget" data-lat="${in_param.value.value.lat}" data-lng="${in_param.value.value.lon}"></div>`;}
                }

                a+=`</div>`;
            });

            if (display_out_params.length > 0)
                a += `<div class="program-results"></div>`;

            if (is_list) {
                a += `<div class="arrow-container">
                <button type="button" class="btn btn-default arrow arrow-prev">
                    <i class="fa fa-chevron-left" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-default arrow arrow-next">
                    <i class="fa fa-chevron-right" aria-hidden="true"></i>
                </button>
                </div>
                `;
            }

            function createOneProgramResult(result, outputElements) {
                let alt_text ='';
                if (has_alt_text)
                    alt_text = `title="${escapeHTML(String(result.raw.alt_text))}"`;

                let a = `<div class="program-result-item" ${alt_text}>`;

                if (has_link) {
                    let link = result.raw.link;
                    a += `<a href="${escapeHTML(link.value || link)}" target="_blank">`;
                }

                display_out_params.forEach(function([primId, out_param]) {
                    let prim = all_prims2[primId];
                    let ptype = out_param_types[out_param];
                    let out_param_id = next_out_param_id++;

                    let key = prim.selector.kind + ':' + prim.channel + ':' + out_param;
                    let format = MORE_HARDCODED_OUTPUT_PARAMS[key] || HARDCODED_OUTPUT_PARAMS[out_param] || OUTPUT_PARAM_BY_TYPES[String(ptype)];
                    let param_value = result.raw[out_param];
                    let is_long = false;
                    if (ptype.isString && param_value.length >= 100)
                        is_long = true;

                    outputElements.push(out_param_id);
                    let is_picture = ptype.isEntity && ptype.type === 'tt:picture';
                    if (out_param.value === 'video_id')
                        is_picture = true;
                    a += `<div id="parent-output-${out_param_id}" class="program-output-group output-param-${out_param.value}">`;
                    let show_label = shouldShowLabel(out_param);
                    if (show_label === 'before')
                        a += `<div id="output-label-${out_param_id}" class="program-output-label">${out_param.value.replace(/_/g, ' ')}</div>`;
                    a +=     `<div id="output-${out_param_id}" class="program-output ${is_picture ? 'picture': ''} ${is_long ? 'long-output':''}">${format.display(param_value)}</div>`;
                    if (show_label === 'after')
                        a += `<div id="output-label-${out_param_id}" class="program-output-label">${out_param.value.replace(/_/g, ' ')}</div>`;
                    a += `</div>`;
                });
                if (has_link)
                    a += `</a>`;
                a += '</div>';//'

                return $(a);
            }
            // console.log("output_show_count: " + output_show_count)
            function replaceOutputs(result, pos) {
                $('.program-temporary-box', $item).remove();
                data.lastResult = result;
                data.lastResultPos = pos;
                let $placeholder = $('.program-results', $item);
                $placeholder.empty();
                let outputElements = [];
                $placeholder.append(createOneProgramResult(result, outputElements));
                updateOutputLayout(outputElements);
            }
            function updateArrows() {
                $('.arrow', $item).show();
                $('.arrow-next', $item).prop('disabled', data.lastResultPos >= data.resultList.length-1);
                $('.arrow-prev', $item).prop('disabled', data.lastResultPos <= 0);
            }

            let MAX_LIST_ITEMS = 30;
            function appendOutputs(result) {
                if (!data.resultList) {
                    data.resultList = [];
                    data.isUnreadList = [];
                }
                data.resultList.push(result);
                data.isUnreadList.push(true);
                data.unreadItems ++;
                if (data.resultList.length > MAX_LIST_ITEMS) {
                    if (data.lastResultPos !== undefined)
                        data.lastResultPos --;
                    data.resultList.shift();

                    if (data.isUnreadList[0])
                        data.unreadItems --;
                    data.isUnreadList.shift();
                }
                if (!data.lastResult)
                    replaceOutputs(result, 0);
                updateArrows();
                $(".program-notification-count", $item).text(data.unreadItems);
                $(".program-notification-badge", $item).show();
            }
            function replaceOutputList(resultList) {
                data.resultList = resultList;
                data.isUnreadList = resultList.map(function() { return true; });
                data.lastResultPos = 0;
                data.unreadItems = resultList.length;
                replaceOutputs(resultList[0], 0);
                updateArrows();
                $(".program-notification-count", $item).text(data.unreadItems);
                $(".program-notification-badge", $item).show();
            }
            function markItemRead() {
                if (data.isUnreadList[data.lastResultPos]) {
                    data.isUnreadList[data.lastResultPos] = false;
                    data.unreadItems--;
                }

                $(".program-notification-count", $item).text(data.unreadItems);
                if (data.unreadItems === 0)
                    $(".program-notification-badge", $item).hide();
            }

            function selectOutput(movement) {
                if (data.lastResultPos === undefined) {
                    alert("How did you get here?");
                    return;
                }

                let next = data.lastResultPos + movement;
                if (next >= data.resultList.length)
                    next = data.resultList.length -1;
                if (next < 0)
                    next = 0;
                replaceOutputs(data.resultList[next], next);
                updateArrows();
                markItemRead();
            }

            let button;
            if (!has_trigger) {
                if (!has_action && input_rects.length === 0) {
                    button = '<i class="fa fa-repeat fa-lg"></i>';
                    title = '';
                } else {
                    button = first_two_words;
                }

                a += `<a
                    class="btn btn-default btn-sm button-execute"
                    href="#">${button}</a>`;
            } else {
                a += `<div class="switch-when-container"><div class="checkbox checkbox-slider--b switch-when">
                        <label>
                            <input type="checkbox" class="checkbox-activate-program" ${data.currentAppId ? 'checked' : ''}><span class="checkbox-activate-program-label indicator-success"></span>
                        </label>
                    </div></div>`;
            }

            if (title === button ||
                (all_prims2.length === 1 && (button === 'send' || button === 'post' || button === 'search')))
                title = '';
            if (title === 'set minimum maximum temperature')
                title = 'set min max temperature';
            if (title)
                a += `<div class="program-title">${title}</div>`;
            else if (inputOutputAssignment['__title'])
                emptyBoxes.push(inputOutputAssignment['__title']);

            // a += `<div class='color_background' style='position: absolute; top: 0px; left: 0px; background-color: ${randomColor()}; width: 89px; height: 89px'></div>`


            a += '</div>';

            let $item = $(a);
            $item.attr('data-tile-id', data.uniqueId);
            function escapeBackgroundImage(url) {
                return encodeURIComponent(url).replace(/[!'()*]/g, function(c) {
                    return '%' + c.charCodeAt(0).toString(16);
                });
            }
            if (!options.disableBackground) {
                $item.css({
                    backgroundImage: 'url(https://thingpedia.stanford.edu/brassau/backgrounds/' + escapeBackgroundImage(background_image) + ')',
                    backgroundSize: 'contain',
                    //backgroundColor: rgbToHex(backgroundMeta['color-palette'][0])
                });
            }
            $grid.prepend( $item ).packery( 'prepended', $item);
            //$item.draggabilly()
            //let draggie = $item.data('draggabilly')
            //$grid.packery( 'bindDraggabillyEvents', draggie )


            $item.css({
                border: `2.5px solid gray`
            });

            $(".program-notification-badge", $item).hide();
            $(".arrow", $item).hide();
            $(".arrow-next", $item).on('tap', function() { selectOutput(1); });
            $(".arrow-prev", $item).on('tap', function() { selectOutput(-1); });
            $(".checkbox-switch", $item).bootstrapSwitch();
            /*$(".location-widget", $item).each(function(i, element) {
                let $element = $(element)
                let lat = parseFloat($element.attr('data-lat'))
                let lng = parseFloat($element.attr('data-lng'))
                let map = new google.maps.Map(element, {
                    zoom: 10,
                    center: { lat: lat, lng: lng }
                })
                let marker = new google.maps.Marker({
                    position: { lat: lat, lng: lng },
                    map: map
                })
            })*/

            $("input.program-input, textarea.program-input, select.program-input, .program-input.location-widget", $item).on('mousedown', (event) => {
                event.stopPropagation();
            });
            $("input.program-input, textarea.program-input, select.program-input, .program-input.location-widget", $item).on('touchstart', (event) => {
                event.stopPropagation();
            });

            function bindInputParamChange(event, state) {
                let element = this;
                $(element).removeClass('incomplete');
                let in_param_handler;
                if (element.name)
                    in_param_handler = in_param_map[element.name.substr('input-'.length)];
                else
                    in_param_handler = in_param_map[element.id.substr('input-'.length)];
                in_param_handler.onchange(element, event, state);
                candidate.description = describe_program(program);
                $('#input_command').val(candidate.description);
            }
            $("input.program-input, select.program-input, textarea.program-input", $item).on('change', bindInputParamChange);
            $(".program-input.checkbox-switch", $item).on('switchChange.bootstrapSwitch', bindInputParamChange);
            $(".program-input.entity-drop-down", $item).each(function(i, element) {
                let $el = $(element);
                let entityType = $el.attr('data-entity-type');
                let in_param_handler;
                if (element.name)
                    in_param_handler = in_param_map[element.name.substr('input-'.length)];
                else
                    in_param_handler = in_param_map[element.id.substr('input-'.length)];

                $.ajax('https://thingpedia.stanford.edu/thingpedia/api/entities/list/' + entityType).then(function(res) {
                    let data = res.data || [];
                    data.forEach(function(item) {
                        let $option = $('<option>').attr('value', item.id).text(item.name);
                        if (item.id === in_param_handler.in_param.value.value)
                            $option.attr('selected', 'selected');

                        $el.append($option);
                    });
                });
            });

            updateInputLayout(Object.keys(in_param_map));
            if (!options.disableLayout && inputOutputAssignment['__action_button']) {
                let button_rect = inputOutputAssignment['__action_button'];
                putElementInBox('.button-execute', button_rect, action_button_color);
                putElementInBox('.switch-when-container', button_rect, action_button_color, true);
                if (!button_rect.cover) {
                    $('.button-execute', $item).css({
                        background: 'none',
                        border: 'none',
                    }).text('');
                } else {
                    $('.button-execute', $item).css({
                        /*borderTopColor: button_rect['top-color'],
                        borderLeftColor: button_rect['left-color'],
                        borderRightColor: button_rect['right-color'],
                        borderBottomColor: button_rect['bottom-color']*/
                        border: 'none'
                    });
                }
            } else {
                $('.button-execute', $item).css({
                    position: 'absolute',
                    bottom: 3,
                    right: 3,
                });
            }
            if (!options.disableLayout && inputOutputAssignment['__logo']) {
                let logo_rect = inputOutputAssignment['__logo'];
                putElementInBox('.program-logo', logo_rect, colors_dominant[0]);
            } else {
                $('.program-logo', $item).css({
                    'opacity': .75,
                    '-webkit-filter': 'drop-shadow(0px 0px 10px rgba(255,255,255,0.5))',
                });
            }
            if (!options.disableLayout && inputOutputAssignment['__title']) {
                let title_rect = inputOutputAssignment['__title'];
                putElementInBox('.program-title', title_rect, title_color);
                if (!title_rect.cover) {
                    $('.program-title', $item).css({
                        background: 'none',
                        border: 'none',
                    }).text('');
                }
            } else {
                $('.program-title', $item).css({
                    position: 'absolute',
                    top: 5,
                    right: '12%',
                    left: (10 * all_prims2.length) + '%',
                    height: '1.2em',
                    margin: 'auto',
                    textAlign: 'center'
                }).addClass('autofontsize');
                if (!options.disableBackground) {
                    $('.program-title', $item).css({
                        color: title_color
                    });
                }
            }
            if (!options.disableLayout) {
                emptyBoxes.forEach(createEmptyBox);
                output_rects.forEach(function(rect) {
                    let box = createEmptyBox(rect);
                    if (box)
                        box.addClass('program-temporary-box');
                });
            }

            function executeGetOrDo(event) {
                console.log('executeGetOrDo');
                if (event)
                    event.preventDefault();
                if (!isProgramComplete(program)) {
                    console.log('program is incomplete');
                    $('.incomplete', $item).focus();
                    return;
                }
                let code = ThingTalk.Ast.prettyprint(program);
                // console.log('new code', code);
                if (code !== candidate.code) {
                    candidate.code = code;
                    tileStorageManager.storeTile(data);
                }

                ThingEngineApi.createApp({
                    code: code,
                    locations: {
                        current_location: {
                            x: -122.173239,
                            y: 37.4299195
                        }
                    }
                }).then(function(response) {
                    console.log("executeGetOrDo callback");
                    console.log(response);
                    let results = response.results;
                    if (results.length === 0) {
                        console.log("no output results");
                        return;
                    }
                    replaceOutputList(results);
                    if (!$item.hasClass('grid-item--small'))
                        markItemRead();
                    tileStorageManager.storeTile(data);
                    // the item might have changed size, reflow it
                    $grid.packery('fit', $item);
                    $grid.packery('layout');
                });
            }

            let whenListener;
            if (has_trigger) {
                whenListener = function(result) {
                    if (is_list)
                        appendOutputs(result);
                    else
                        replaceOutputList([result]);
                    if (!$item.hasClass('grid-item--small'))
                        markItemRead();
                    tileStorageManager.storeTile(data);
                    // the item might have changed size, reflow it
                    $grid.packery('fit', $item);
                    $grid.packery('layout');
                };
            }
            function executeWhen(event) {
                let state = this.checked;
                let code = ThingTalk.Ast.prettyprint(program);
                if (code !== candidate.code) {
                    candidate.code = code;
                    tileStorageManager.storeTile(data);
                }
                //$('.checkbox-activate-program-label', $item).text('\xa0\xa0' + (state ? 'active' : 'inactive'))

                if (state) {
                    if (data.currentAppId !== null)
                        return;

                    if (!isProgramComplete(program)) {
                        $('.incomplete', $item).focus();
                        this.checked = false;
                        $('.checkbox-activate-program-label', $item).text('\xa0\xa0inactive');
                        return;
                    }
                    console.log('starting app', code);
                    let params = {
                        code: code,
                        locations: {
                            current_location: {
                                x: -122.173239,
                                y: 37.4299195
                            }
                        }
                    };

                    appManager.startApp(params, whenListener).then((appId) => {
                        data.currentAppId = appId;
                        tileStorageManager.storeTile(data);
                    }, (err) => {
                        alert('error: ' + err);
                    });
                } else {
                    if (data.currentAppId === null)
                        return;
                    console.log('stopping app', data.currentAppId);
                    let appId = data.currentAppId;
                    data.currentAppId = null;
                    tileStorageManager.storeTile(data);
                    appManager.stopApp(appId).catch((err) => {
                        alert('error: ' + err);
                    });
                }
            }

            if (has_trigger) {
                $(".checkbox-activate-program", $item).on('change', executeWhen);
                if (data.currentAppId)
                    appManager.addAppListener(data.currentAppId, whenListener);
            } else {
                $(".button-execute", $item).on('tap', executeGetOrDo);
                if (!has_action) {
                    if (!data.lastResult && isProgramComplete(program))
                        executeGetOrDo();
                }
            }
            if (data.lastResult) {
                replaceOutputs(data.lastResult, data.lastResultPos);
                updateArrows();
            }
            if (data.unreadItems === undefined)
                data.unreadItems = 0;
            $(".program-notification-count", $item).text(data.unreadItems);
            if (data.unreadItems > 0)
                $(".program-notification-badge", $item).show();
            data.onexpand = function() {
                if (!options.disableLayout) {
                    textFit($('.autofontsize .program-constant-input', $item), { minFontSize: 12 });
                    textFit($('.autofontsize .program-output:not(.picture)', $item), { alignVert: true, multiLine: true, minFontSize: 10, maxFontSize: 16 });
                    textFit($('.program-title.autofontsize', $item), { multiLine: false, minFontSize: 12, maxFontSize: 30 });
                    textFit($('.button-execute.autofontsize', $item), { multiLine: false, minFontSize: 12, maxFontSize: 30 });
                }

                if (has_trigger || is_list) {
                    if (data.lastResult)
                        markItemRead();
                    tileStorageManager.storeTile(data);
                }
            };

            $('.close', $item).on('tap', function() {
                if (data.currentAppId) {
                    console.log('deleting and stopping app', data.currentAppId);
                    let appId = data.currentAppId;
                    data.currentAppId = null;
                    appManager.stopApp(appId).catch((err) => {
                        alert('error: ' + err);
                    });
                } else {
                    console.log('deleting tile ' + data.uniqueId);
                }
                tileStorageManager.deleteTile(data);
                $grid.packery('remove', $item);
            });

            function putElementInBox(selector, rect, color, forceCover) {
                let FONT_FAMILIES = {
                    'sans': '"Montserrat", sans-serif',
                    'serif': '"Source Serif Pro", serif',
                    'display': '"Comfortaa", sans-serif',
                    'handwriting': '"Indie Flower", cursive',
                    'monospace': '"Space Mono", monospace'
                };
                let box = toWidthHeight(rect.coordinates);

                let $element = $(selector, $item);
                $element.addClass('box-' + rect.label);
                $element.css({
                    zIndex: 1,
                    position: 'absolute',
                    width: box.width + '%',
                    height: box.height + '%',
                    left: box.left + '%',
                    top: box.top + '%',
                });
                if (rect['font-size']) {
                    $element.css({
                        fontSize: (rect['font-size']/2) + 'px',
                    });
                } else {
                    $element.addClass('autofontsize');
                }
                if (rect['text-align']) {
                    $element.css({
                        textAlign: rect['text-align']
                    });
                }
                if (rect['font-family']) {
                    $element.css({
                        fontFamily: FONT_FAMILIES[rect['font-family']]
                    });
                }

                if (!options.disableBackground) {
                    if (color) {
                        $element.css({
                            color: color
                        });
                    }
                    if (rect.cover || forceCover) {
                        $element.css({
                            backgroundImage: `linear-gradient(90deg, rgb(${rect['left-color']}), rgb(${rect['right-color']}))`,
                        });
                    }
                }

                return box;
            }
            function createEmptyBox(rect) {
                if (!rect.cover)
                    return null;

                let $element = $('<div>');
                $item.append($element);
                let box = toWidthHeight(rect.coordinates);

                $element.attr('role', 'presentation');
                $element.css({
                    zIndex: 0,
                    position: 'absolute',
                    width: box.width + '%',
                    height: box.height + '%',
                    left: box.left + '%',
                    top: box.top + '%',
                });
                if (!options.disableBackground) {
                    $element.css({
                        backgroundImage: `linear-gradient(90deg, rgb(${rect['left-color']}), rgb(${rect['right-color']}))`,
                    });
                }

                return $element;
            }

            function updateInputLayout(inputElements) {
                if (options.disableLayout)
                    return;
                for (let i = 0; i < inputElements.length && i < input_rects.length; i++) {
                    let box = putElementInBox("#parent-input-"+inputElements[i], input_rects[i], input_colors[i]);

                    let in_param_handler = in_param_map[inputElements[i]];
                    if (in_param_handler.in_param_type === 'slider') {
                        let orientation = 'horizontal';
                        if (box.height > box.width)
                            orientation = 'vertical';
                        $('#input-' + inputElements[i]).slider({ orientation });
                    }
                }
            }

            function updateOutputLayout(outputElements) {
                if (options.disableLayout)
                    return;
                for (let i = 0; i < outputElements.length && i < output_rects.length; i++) {
                    putElementInBox("#parent-output-"+outputElements[i], output_rects[i], output_colors[i]);
                    //let box = toWidthHeight(output_rects[i].coordinates);

                    $('#parent-output-'+outputElements[i] + ' img', $item).css({
                        boxShadow: '0px 0px 5px ' + output_colors[i]
                    });
                }

                //if (!$item.hasClass('grid-item--small'))
                textFit($('.autofontsize .program-output:not(.picture)', $item), { alignVert: true, multiLine: true, minFontSize: 10, maxFontSize: 16 });

            }

            return $item;
        });
    }

    $grid.on('click', '.grid-item', function(event) {
        event.stopPropagation();
        let $item = $(event.currentTarget);
        let tile = tileStorageManager.getTile($item.attr('data-tile-id'));
        if (!tile)
            return;

        if (!$item.hasClass('grid-item--small'))
            return;

        $('.grid-item').each((el, other) => {
            let $other = $(other);
            if ($other.attr('data-tile-id') === tile.uniqueId)
                return;
            $other.addClass('grid-item--small');//.draggabilly('enable')
        });
        expandTile($item, tile);
    });
});
