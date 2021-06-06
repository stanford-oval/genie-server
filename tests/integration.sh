#!/bin/bash

## Integration tests for Web Almond against public Thingpedia
## (API, web pages)

set -e
set -x
set -o pipefail

srcdir=`dirname $0`/..
srcdir=`realpath $srcdir`

workdir=`mktemp -d almondhome-integration-XXXXXX`
workdir=`realpath $workdir`
on_error() {
    test -n "$serverpid" && kill $serverpid || true
    serverpid=
    wait

    # remove workdir after the processes have died, or they'll fail
    # to write to it
    rm -fr $workdir
}
trap on_error ERR INT TERM

oldpwd=`pwd`
cd $workdir

export THINGENGINE_HOME=$workdir
export PORT=3000

# write a preconfigured prefs.db so we skip initial configuration
# the password is 12345678
cat > $workdir/prefs.db <<EOF
{"session-key":"c93d9605be2029f0c0eaf87720621ea7f1e472d18c14ae912247ee0f60ae490f",
"sqlite-schema-version":8,"sabrina-initialized":true,"sabrina-store-log":"no",
"server-login":
{"password":"6eeb3502d7dbd1c655365b49831c6cb46bb30e8e5317cfb6f3be0ecabb506faf",
"salt":"606cf88b141fbcb3494fea0fccaf32ab3f76f60cfa5c81c10cd7642fee9c3482",
"sqliteKeySalt":"eb8ec4479209b60098cda019d36a9cdad2b2a38d01539f5acc5b925810bd55ac"},
"cloud-sync-device-id":"81e0e8abba27202a",
"enable-voice-input":false,
"enable-voice-output":false}
EOF

# set the server to require authentication so we can run the tests for login
export THINGENGINE_HOST_BASED_AUTHENTICATION=disabled

node $srcdir/src/main.js &
serverpid=$!

# in interactive mode, sleep forever
# the developer will run the tests by hand
# and Ctrl+C
if test "$1" = "--interactive" ; then
    sleep 84600
else
    # sleep until both processes are settled
    sleep 30

    # run the automated link checker
    node $srcdir/tests/linkcheck.js

    # test the website by making HTTP requests directly
    node $srcdir/tests/website

    # test the website in a browser
    SELENIUM_BROWSER=firefox node $srcdir/tests/test_website_selenium.js
fi

kill $serverpid
serverpid=
wait

rm -rf $workdir
