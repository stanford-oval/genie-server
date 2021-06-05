"use strict";
$(function() {
    window.Almond = {
        getThingpedia: function() {
            return 'https://thingpedia.stanford.edu';
        }
    };

    const top = window.parent;
    const url = new URL(top.location.href);
    const params = url.searchParams;
    if (params.has('almond_redirect')) {
        const parsed = new URL(params.get('almond_redirect'), window.location.href);

        // for security reasons, we ignore the protocol/hostname/port
        // and only allow safe-listed paths
        if (!parsed.pathname.startsWith(document.body.dataset.baseUrl + '/devices/oauth2/callback/'))
            return;

        let redirectTo = parsed.pathname;
        for (const [key, value] of params) {
            if (key === 'almond_redirect')
                continue;
            parsed.searchParams.append(key, value);
        }
        redirectTo += '?' + parsed.searchParams;

        // remove the query params from the top URL
        url.search = '';
        top.history.replaceState(null, '', url.toString());

        window.location.href = redirectTo;
    }
});
