FROM docker.io/fedora:31

# Install all deps in the standard repos
RUN dnf -y module install nodejs:10 && \
    dnf -y install git curl pulseaudio-libs-devel unzip nodejs make gcc gcc-c++ libcanberra-devel atlas-devel blas-devel python-unversioned-command

# Install yarn
RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo
RUN dnf -y install yarn

RUN mkdir /opt/almond
COPY . /opt/almond
WORKDIR /opt/almond

# snowboy doesn't like building in docker, due to overlayfs bugs, so
# we need to some insisting
RUN rm -rf /opt/almond/node_modules && \
    mkdir -p ./node_modules/snowboy/build/Release/.deps/Release/obj.target/snowboy/swig/Node && \
    touch ./node_modules/snowboy/build/Release/.deps/Release/obj.target/snowboy/swig/Node/snowboy.o.d.raw && \
    yarn && \
    ls -al ./node_modules/snowboy/build/Release/snowboy.node && \
    rm -fr /usr/local/share/.cache

EXPOSE 3000
ENV THINGENGINE_HOME=/var/lib/almond-server
ENV PULSE_SOCKET=unix:/run/pulse/native

ENTRYPOINT [ "yarn", "start"]
