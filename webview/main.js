// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2018 The Board of Trustees of the Leland Stanford Junior University
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
"use strict";

const System = imports.system;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const WebKit = imports.gi.WebKit2;

const BrowserWindow = GObject.registerClass(class BrowserWindow extends Gtk.ApplicationWindow {
    _init(app) {
        super._init({ application: app, title: "Almond" });

        let webview = new WebKit.WebView({
            web_context: app.webContext,
            hexpand: true,
            vexpand: true,
        });
        webview.connect('decide-policy', (webView, decision, decisionType) => {
            if (decisionType !== WebKit.PolicyDecisionType.NAVIGATION_ACTION)
                return false;

            let uri = decision.request.uri;
            if (uri.startsWith('https://thingengine.stanford.edu/devices/oauth2/callback')) {
                let path = uri.substring('https://thingengine.stanford.edu'.length);
                decision.ignore();

                log('Got redirect to ' + uri);
                webview.load_uri('http://127.0.0.1:3000' + path);
                return true;
            }

            return false;
        });
        webview.load_uri('http://127.0.0.1:3000');

        webview.show();

        let refreshAction = new Gio.SimpleAction({ name: 'refresh' });
        refreshAction.connect('activate', () => {
            webview.reload();
        });
        let refreshNoCacheAction = new Gio.SimpleAction({ name: 'refresh-nocache' });
        refreshNoCacheAction.connect('activate', () => {
            webview.reload_bypass_cache();
        });
        this.add_action(refreshAction);
        this.add_action(refreshNoCacheAction);

        this.application.set_accels_for_action('win.refresh', ['F5']);
        this.application.set_accels_for_action('win.refresh-nocache', ['<Shift>F5']);

        this.add(webview);
        this.fullscreen();
        this.show();
    }
});

const EmbeddedBrowserApplication = GObject.registerClass(class EmbeddedBrowserApplication extends Gtk.Application {
    vfunc_startup() {
        super.vfunc_startup();

        let quitAction = new Gio.SimpleAction({ name: 'quit' });
        quitAction.connect('activate', () => {
            let win = this.get_active_window();
            if (win)
                win.destroy();
        });
        this.add_action(quitAction);

        let webDataManager = new WebKit.WebsiteDataManager({
            base_cache_directory: GLib.get_user_cache_dir() + '/almond-server/webview',
            base_data_directory: GLib.get_user_config_dir() + '/almond-server/webview'
        });
        let webCookieManager = webDataManager.get_cookie_manager();
        webCookieManager.set_accept_policy(WebKit.CookieAcceptPolicy.NO_THIRD_PARTY);
        webCookieManager.set_persistent_storage(GLib.get_user_config_dir() + '/almond-server/webview/cookies.db',
                                                WebKit.CookiePersistentStorage.SQLITE);
        this.webContext = new WebKit.WebContext({
            website_data_manager: webDataManager
        });
    }

    vfunc_activate() {
        let window = this.get_active_window();
        if (window === null)
            window = new BrowserWindow(this);
        else
            window.present();
    }
});

function main() {
    const application = new EmbeddedBrowserApplication();
    return application.run([System.programInvocationName].concat(ARGV));
}
main();
