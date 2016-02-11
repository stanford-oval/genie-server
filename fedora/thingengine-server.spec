Name:           thingengine-server
Version:        %{_version}
Release:        1%{?dist}
Summary:        An Engine to run IoT apps and interact with devices, based on node.js

# The entire source code is GPLv2+ except various node_modules are
# BSD or MIT
License:        GPLv2+ and BSD and MIT
URL:            https://thingpedia.stanford.edu
Source0:        thingengine-server-1.0.0.tar.gz

BuildRequires:  npm, nodejs-devel, systemd
BuildRequires:  nodejs-sqlite3 >= 3.0.8
BuildRequires:  nodejs-ws >= 0.7.0
BuildRequires:  nodejs-node-uuid >= 1.4.0
BuildRequires:  nodejs-xml2js >= 0.4.4
Requires:       nodejs
Requires(pre):  shadow-utils
Requires(post): systemd
Requires(preun): systemd
Requires(postun): systemd

%description
ThingEngine allows you to run small apps and rules on your phone
and private server, to privately manage your data and your IoT
devices, including medical sensors, security cameras, fitness bands
and communication devices.
thingengine-server is the private server component that you can run
on a raspberry-pi, a small unused laptop in the corner of your room,
or dedicated cloud infrastructure such as OpenStack.

%prep
%setup -q


%build
make all-fedora prefix=/opt/thingengine pkglibdir=/opt/thingengine/lib/server localstatedir=/opt/thingengine/var/server systemdsystemunitdir=%{_unitdir}


%install
rm -rf $RPM_BUILD_ROOT
%make_install prefix=/opt/thingengine pkglibdir=/opt/thingengine/lib/server localstatedir=/opt/thingengine/var/server systemdsystemunitdir=%{_unitdir}


%pre
getent group thingengine >/dev/null || groupadd -r thingengine
getent passwd thingengine >/dev/null || \
    useradd -r -g thingengine -d /opt/thingengine/var/server -s /sbin/nologin \
    -c "ThingEngine user" thingengine
exit 0

%post
%systemd_post thingengine-server.service


%preun
%systemd_preun thingengine-server.service


%postun
%systemd_postun_with_restart thingengine-server.service


%files
%doc
/opt/thingengine
/usr/lib/systemd/system/thingengine-server.service


%changelog
* Fri Sep 11 2015 Giovanni Campagna
- Initial release
