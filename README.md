# Almond For Home Servers

[![Build Status](https://travis-ci.com/stanford-oval/almond-server.svg?branch=master)](https://travis-ci.com/stanford-oval/almond-server) [![Coverage Status](https://coveralls.io/repos/github/stanford-oval/almond-server/badge.svg?branch=master)](https://coveralls.io/github/stanford-oval/almond-server?branch=master) [![Dependency Status](https://david-dm.org/stanford-oval/almond-server/status.svg)](https://david-dm.org/stanford-oval/almond-server) [![Greenkeeper badge](https://badges.greenkeeper.io/stanford-oval/almond-server.svg)](https://greenkeeper.io/) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/stanford-oval/almond-server.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/stanford-oval/almond-server/context:javascript)

## End User Programmable Virtual Assistants

This repository contains home server version of Almond, the end user programmable
assistant. It is a single-user version, suitable for running on low-power
devices and smart speakers.

Almond is part of Open Thing Platform, a research project led by
prof. Monica Lam, from Stanford University.  You can find more
information at <https://thingpedia.stanford.edu/about>.

## Installation

This assumes that you have [node](https://github.com/nodejs/node) and [yarn](https://github.com/yarnpkg/yarn) installed, with at least **600 MB** of available diskspace. Please be sure to be on a **fast internet connection** before going through the installation.

1. Clone this repo on your machine.
```
git clone https://github.com/stanford-oval/almond-server.git
```

2. Install libpulse.
```
# On Ubuntu/Debian
sudo apt-get install libpulse-dev
```

3. Install all packages and build bundle. 
```
yarn
yarn build-react
```

4. Start Almond server.
```
yarn start
```

5. Navigate to [localhost:3000](http://localhost:3000).

### Enabling Voice

To get voice working, first go to [almond-voice](https://github.com/euirim/almond-voice) and clone the repository. Then, run `yarn start-api:dev`. By default this serves a speech-to-text endpoint at `http://127.0.0.1:8000/rest/stt`. If you change this, remember to set the new endpoint in your `.env` file here as well under the `REACT_APP_STTURL` variable, so your new `.env` file should go something like.

```
REACT_APP_ACCESS_TOKEN="eyJhbGsomethingsomethingsomething"
REACT_APP_STTURL="http://127.0.0.1:yourport/rest/stt"
```

Next, run the chat interface and click on the mic button at the bottom right to start recording. Click again to stop recording after speaking your command.
