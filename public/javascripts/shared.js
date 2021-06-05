"use strict";
(function() {
    window.Almond = {
        getThingpedia: function() {
            return 'https://thingpedia.stanford.edu';
        }
    };

    const top = window.parent.location;
    if (!top)
        return;
    const params = new URLSearchParams(top.search.substring(1));
    if (params.has('almond_redirect')) {
        const parsed = new URL(params.get('almond_redirect'), window.location.href);

        // for security reasons, we ignore the protocol/hostname/port
        // and only allow safe-listed paths
        if (!parsed.pathname.startsWith('/devices/oauth2/callback/'))
            return;

        let redirectTo = parsed.pathname;
        for (const [key, value] of params) {
            if (key === 'almond_redirect')
                continue;
            parsed.searchParams.append(key, value);
        }
        redirectTo += '?' + parsed.searchParams;
        window.location.href = redirectTo;
    }
})();
