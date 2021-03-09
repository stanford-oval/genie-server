# Almond For Home Servers

[![Build Status](https://travis-ci.com/stanford-oval/almond-server.svg?branch=master)](https://travis-ci.com/stanford-oval/almond-server) [![Coverage Status](https://coveralls.io/repos/github/stanford-oval/almond-server/badge.svg?branch=master)](https://coveralls.io/github/stanford-oval/almond-server?branch=master) [![Dependency Status](https://david-dm.org/stanford-oval/almond-server/status.svg)](https://david-dm.org/stanford-oval/almond-server) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/stanford-oval/almond-server.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/stanford-oval/almond-server/context:javascript)

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
podman run --name almond -p 3000:3000 \
    -v /dev/shm:/dev/shm \
    -v $XDG_RUNTIME_DIR/pulse:/run/pulse \
    --security-opt label=disable \
    stanfordoval/almond-server
```

You can now navigate to [127.0.0.1:3000](http://127.0.0.1:3000) to access Almond, or use your voice with the hotword "computer".

### I am a Mac!

Voice support is only available on Linux. On Mac or Windows, you can use the following docker command:

```bash
docker run --name almond -p 3000:3000 stanfordoval/almond-server:latest-portable
```

### I am Kubernetes!

As an alternative, Almond-Server can run under Kubernetes; see sample configuration file in the [examples](https://github.com/stanford-oval/almond-server/tree/master/examples) directory for information on how to get started.

## Development setup

To develop almond-server, you should clone this repository, then install the dependencies with:

```bash
dnf -y install nodejs make gcc-c++ GraphicsMagick unzip # Fedora/RHEL
apt -y install nodejs build-essential make g++ graphicsmagick unzip # Ubuntu/Debian
```

You can then build the repository with:
```
npm install
```

This will only install the minimal set of dependencies, and will not install any voice support. To enable voice, you must also run (Linux only):
```
dnf -y install pulseaudio pulseaudio-libs-devel libcanberra-devel blas-devel atlas-devel sound-theme-freedesktop # Fedora/RHEL
apt -y install pulseaudio libpulse-dev libcanberra-dev libatlas-base-dev sound-theme-freedesktop # Ubuntu/Debian
```
then run `npm install` again to pick up the new dependencies.

After installing the dependencies locally, the server can be started using `npm start`. 
