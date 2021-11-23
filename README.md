# Genie For Home Servers

[![Build Status](https://travis-ci.com/stanford-oval/genie-server.svg?branch=master)](https://travis-ci.com/stanford-oval/genie-server) [![Coverage Status](https://coveralls.io/repos/github/stanford-oval/genie-server/badge.svg?branch=master)](https://coveralls.io/github/stanford-oval/genie-server?branch=master) [![Dependency Status](https://david-dm.org/stanford-oval/genie-server/status.svg)](https://david-dm.org/stanford-oval/genie-server) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/stanford-oval/genie-server.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/stanford-oval/genie-server/context:javascript)

## End User Programmable Virtual Assistants

This repository contains the standalone version of Genie, the end user programmable
assistant. It is a single-user version, suitable for running on home servers and
smart speakers.

Genie is a research project from the Stanford University Open Virtual Assistant Lab.
You can find more information at <https://oval.cs.stanford.edu>.

## Running Genie standalone

The recommended way to run Genie is through [podman](https://podman.io/), a replacement for [docker](https://docs.docker.com/install/) that allows
the container to run as your regular user (and thus access PulseAudio from your normal session). You can find the installation instructions [here](https://podman.io/getting-started/installation).
If you use regular docker rather than podman, audio support might not work.

To run, use the command:
```bash
podman run --name genie -p 3000:3000 \
    -v /dev/shm:/dev/shm \
    -v $XDG_RUNTIME_DIR/pulse:/run/pulse \
    -e PULSE_SERVER=unix:/run/pulse/native \
    -v $XDG_CONFIG_HOME/genie-server:/var/lib/genie-server \
    --security-opt label=disable \
    docker.io/stanfordoval/almond-server
```

You can now navigate to [127.0.0.1:3000](http://127.0.0.1:3000) to access Genie, or use your voice with the hotword "computer".

To manage the container later, you can use:
```bash
podman start genie # start the container again
podman stop genie # stop the container
podman logs genie # look at the most recent logs of a running container
```

## Development setup

To develop genie-server, you should clone this repository, then install the dependencies with:

```bash
dnf -y install nodejs gettext make gcc-c++ GraphicsMagick zip unzip pulseaudio-libs-devel # Fedora/RHEL
apt -y install nodejs gettext build-essential make g++ graphicsmagick zip unzip libpulse-dev # Ubuntu/Debian
```

You can then build the repository with:
```
npm ci
```

This will only install the minimal set of dependencies, and will not install any voice support. To enable voice, you must also install [genie-client-cpp](https://github.com/stanford-oval/genie-client-cpp).

After installing the dependencies locally, the server can be started using `npm start`. The server is accessible on port 3000.
