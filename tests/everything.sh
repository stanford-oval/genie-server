#!/bin/sh

set -e
set -x

export THINGENGINE_NLP_URL=https://nlp-staging.almond.stanford.edu
export THINGPEDIA_URL=https://dev.almond.stanford.edu/thingpedia
export THINGENGINE_CLOUD_SYNC_URL=https://dev.almond.stanford.edu

srcdir=`dirname $0`/..

# unit tests
node $srcdir/tests/unit

# integration tests
# (these spawn the whole system, with all the bells and whistles,
# and fire requests at it, checking the result)

$srcdir/tests/integration.sh
