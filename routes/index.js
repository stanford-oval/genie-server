const os = require('os');
const express = require('express');
var router = express.Router();

const ipAddress = require('../../engine/util/ip_address');
const user = require('../util/user');

router.get('/', user.redirectLogIn, function(req, res, next) {
    ipAddress.getServerName().then(function(host) {
        var port = res.app.get('port');

        var prefs = platform.getSharedPreferences();
        var cloudId = prefs.get('cloud-id');
        var authToken = prefs.get('auth-token');

        if (host !== os.hostname())
            var name = os.hostname() + " (" + host + ")";
        res.render('index', { page_title: "ThingEngine - run your things!",
                              server: { name: name,
                                        port: port,
                                        initialSetup: authToken === undefined },
                              cloud: { isConfigured: cloudId !== undefined } });
    }).done();
});

module.exports = router;
