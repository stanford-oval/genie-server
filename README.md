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
