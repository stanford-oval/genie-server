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

const env = {
  es6: true,
  node: true,
  browser: true
};

const parserOptions = {
  ecmaVersion: 2017,
  ecmaFeatures: {
    modules: true
  }
};

const rules = {
  indent: 'off',
  'no-console': 'off',
  'no-fallthrough': 'off',
  'linebreak-style': ['error', 'unix'],
  semi: ['error', 'always'],
  'consistent-return': 'error',
  curly: ['error', 'multi-or-nest', 'consistent'],
  eqeqeq: ['error', 'always'],
  'no-unused-vars': ['error', { args: 'none' }],
  'no-case-declarations': 'warn',
  'no-eval': 'error',
  'no-proto': 'error',
  'no-sequences': 'error',
  'no-throw-literal': 'error',
  'no-unmodified-loop-condition': 'warn',
  'no-useless-call': 'warn',
  'no-useless-return': 'warn',
  'no-void': 'error',
  'prefer-promise-reject-errors': 'error',
  strict: ['error', 'global'],
  'no-label-var': 'error',
  'no-lonely-if': 'off',
  'no-new-object': 'error',
  'arrow-body-style': 'off',
  'arrow-parens': ['error', 'always'],
  'prefer-arrow-callback': 'warn',
  'prefer-numeric-literals': 'error',
  'require-atomic-updates': 'off',
  'react/prop-types': 'off',
  'react/display-name': 'off'
};

const overrides = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      sourceType: 'module'
    },
    plugins: ['react', '@typescript-eslint'],
    settings: { react: { version: 'detect' } }
  }
];

module.exports = {
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  env,
  overrides,
  parserOptions,
  rules
};
