FROM docker.io/fedora:31

# Install all deps in the standard repos
RUN dnf -y module install nodejs:10 && \
    dnf -y install git curl pulseaudio-libs-devel unzip nodejs make gcc gcc-c++ libcanberra-devel atlas-devel blas-devel python2

# Install yarn
RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo
RUN dnf -y install yarn

RUN mkdir /opt/almond
COPY . /opt/almond
WORKDIR /opt/almond

# snowboy doesn't like building in docker, due to overlayfs bugs...
RUN rm -rf /opt/almond/node_modules && \
    yarn && \
    cp -Tr /usr/local/share/.cache/yarn/v6/npm-snowboy-1.3.1-220f23f026096fe5290d7919a9f0da93ccd253f2-integrity/node_modules/snowboy/ node_modules/snowboy/ && \
    rm -fr /usr/local/share/.cache
RUN cd node_modules/snowboy/ && \
    yarn install --ignore-scripts --no-lockfile && \
    PYTHON=python2 yarn run node-pre-gyp clean configure && \
    make -C build/ && \
    rm -fr /usr/local/share/.cache

EXPOSE 3000
ENV THINGENGINE_HOME=/var/lib/almond-server
ENV PULSE_SOCKET=unix:/run/pulse/native

ENTRYPOINT [ "yarn", "start"]
