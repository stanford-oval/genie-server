# Almond For Home Servers

[![Build Status](https://travis-ci.com/stanford-oval/almond-server.svg?branch=master)](https://travis-ci.com/stanford-oval/almond-server) [![Coverage Status](https://coveralls.io/repos/github/stanford-oval/almond-server/badge.svg?branch=master)](https://coveralls.io/github/stanford-oval/almond-server?branch=master) [![Dependency Status](https://david-dm.org/stanford-oval/almond-server/status.svg)](https://david-dm.org/stanford-oval/almond-server) [![Greenkeeper badge](https://badges.greenkeeper.io/stanford-oval/almond-server.svg)](https://greenkeeper.io/) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/stanford-oval/almond-server.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/stanford-oval/almond-server/context:javascript)

## End User Programmable Virtual Assistants

This repository contains home server version of Almond, the end user programmable
assistant. It is a single-user version, suitable for running on low-power
devices and smart speakers.

Almond is part of Open Thing Platform, a research project led by
prof. Monica Lam, from Stanford University.  You can find more
information at <https://thingpedia.stanford.edu/about>.

## To Run

This assumes that you have [docker](https://docs.docker.com/install/) and [docker-compose](https://docs.docker.com/compose/install/) installed, with at least **2 GB** of available diskspace. Please be sure to be on a **fast internet connection** before running through this process for the first time.

1. Clone this repo to your machine.
```
git clone https://github.com/stanford-oval/almond-server.git
```

2. Run docker-compose.  
```
docker-compose up
```
**Note:** This command can take a long time depending on the speed of your internet connection as well as your access to processing power.

3. Navigate to [localhost:3000](http://localhost:3000) to access Almond.