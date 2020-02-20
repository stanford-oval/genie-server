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
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, 'react', 'index'),
  output: {
    path: path.resolve(__dirname, 'react_build'),
    filename: 'bundle.js'
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', 'jsx']
  },

  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        // ignore transpiling JavaScript from node_modules as it should be that state
        exclude: /node_modules/,
        // use the babel-loader for transpiling JavaScript to a suitable format
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
          'file-loader',
          { loader: 'image-webpack-loader', options: { disable: true } }
        ]
      }
    ]
  },
  // add a custom index.html as the template
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'react', 'index.html')
    })
  ]
};
