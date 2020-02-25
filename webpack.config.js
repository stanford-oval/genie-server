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

const path = require('path');

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, 'react', 'index'),
  output: {
    path: path.resolve(__dirname, 'public',  'react_build'),
    filename: 'bundle.js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', 'jsx']
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.(gif|png|jpe?g|svg)$/i,
        use: [
          'url-loader',
          { loader: 'image-webpack-loader', options: { disable: true } }
        ]
      }
    ]
  },
};
