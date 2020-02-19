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

This assumes that you have [node](https://github.com/nodejs/node) and [yarn](https://github.com/yarnpkg/yarn) installed, with at least **2 GB** of available diskspace. Please be sure to be on a **fast internet connection** before going through the installation.

1. Clone this repo on your machine.
```
git clone https://github.com/stanford-oval/almond-server.git
```

2. Install libpulse.
```
# On Ubuntu/Debian
sudo apt-get install libpulse-dev
```

3. Install [mimic](https://github.com/MycroftAI/mimic1).

4. Install all packages. 
```
yarn
```

5. Start Almond server.
```
yarn start
```

6. Navigate to [localhost:3000](http://localhost:3000).

## Experimental Chat Interface

While Almond Server already has a chat interface built using jQuery, the Almond team is currently working on an experimental chat interface written in React that you can try.

### Setup

To use this, first create an Almond developer account [here](https://almond.stanford.edu/user/register). Next, log in to your account and click on [Settings](https://almond.stanford.edu/user/profile) on the top right. Scroll down to "Authorized third-party apps" and click "Issue an Access Token". Copy and paste this access token into a `.env` file under the `REACT_APP_ACCESS_TOKEN` variable like this

```
REACT_APP_ACCESS_TOKEN="eyJhbGsomethingsomethingsomething"
```

Then, `cd` to this folder (`chat`) from the root directory and run `yarn start`.

The chat interface should open in your default browser and ALmond should say "Welcome back!". Try replying with "Tell me a joke"!

### Enabling Voice

To get voice working, first go to [almond-voice](https://github.com/euirim/almond-voice) and clone the repository. Then, run `yarn start-api:dev`. By default this serves a speech-to-text endpoint at `http://127.0.0.1:8000/rest/stt`. If you change this, remember to set the new endpoint in your `.env` file here as well under the `REACT_APP_STTURL` variable, so your new `.env` file should go something like.

```
REACT_APP_ACCESS_TOKEN="eyJhbGsomethingsomethingsomething"
REACT_APP_STTURL="http://127.0.0.1:yourport/rest/stt"
```

Next, run the chat interface and click on the mic button at the bottom right to start recording. Click again to stop recording after speaking your command.