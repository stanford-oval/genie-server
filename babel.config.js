// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 2 -*-
//
// This file is part of ThingEngine
//
// Copyright 2020 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Euirim Choi <euirim@cs.stanford.edu>
//
// See COPYING for details

'use strict';

const presets = [
  '@babel/preset-env',
  '@babel/preset-typescript',
  '@babel/preset-react'
];

const plugins = [
  '@babel/proposal-class-properties',
  '@babel/proposal-object-rest-spread'
];

module.exports = {
  presets,
  plugins
};
