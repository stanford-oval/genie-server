# Almond For Home Servers

[![Build Status](https://travis-ci.com/stanford-oval/almond-server.svg?branch=master)](https://travis-ci.com/stanford-oval/almond-server) [![Coverage Status](https://coveralls.io/repos/github/stanford-oval/almond-server/badge.svg?branch=master)](https://coveralls.io/github/stanford-oval/almond-server?branch=master) [![Dependency Status](https://david-dm.org/stanford-oval/almond-server/status.svg)](https://david-dm.org/stanford-oval/almond-server) [![Greenkeeper badge](https://badges.greenkeeper.io/stanford-oval/almond-server.svg)](https://greenkeeper.io/) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/stanford-oval/almond-server.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/stanford-oval/almond-server/context:javascript)

## End User Programmable Virtual Assistants

This repository contains home server version of Almond, the end user programmable
assistant. It is a single-user version, suitable for running on low-power
devices and smart speakers.

Almond is part of Open Thing Platform, a research project led by
prof. Monica Lam, from Stanford University.  You can find more
information at <https://thingpedia.stanford.edu/about>.

## Running almond-server

The recommended way to run almond-server is through [podman](https://podman.io/), a replacement for [docker](https://docs.docker.com/install/) that allows
the container to run as your regular user (and thus access PulseAudio from your normal session).

To run, use the command:
```bash
podman run -p 3000:3000 --uidmap keep-id \
    -v /dev/shm:/dev/shm \
    -v $XDG_RUNTIME_DIR/pulse:/run/pulse \
    -v ${XDG_CONFIG_HOME:-$HOME/.config}/almond-server:/var/lib/almond-server \
    stanfordoval/almond-server
```

You can now navigate to [127.0.0.1:3000](http://127.0.0.1:3000) to access Almond, or use your voice with the hotword "Almond".

## Development setup

To develop almond-server, you should clone this repository, then install the dependencies with:

```
yarn
```

This will only install the minimal set of dependencies, and will not install any voice support. To enable voice, you must also run (Linux only):
```
dnf -y install pulseaudio-libs-devel mimic-devel python3-numpy python3-scipy portaudio-devel libcanberra-devel
pip3 install 'tensorflow<2.0.0' 'git+https://github.com/stanford-oval/mycroft-precise'
```
then run `yarn` again to pick up the new dependencies.

After installing the dependencies locally, the server can be started using `yarn start`. 
