FROM docker.io/fedora:30

# Install all deps in the standard repos
RUN dnf -y install git curl pulseaudio-libs-devel unzip nodejs mimic-devel python3 python3-pip python3-numpy python3-scipy make gcc gcc-c++ portaudio-devel

# Install yarn
RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo
RUN dnf -y install yarn

# Install mycroft-precise
RUN pip3 install 'tensorflow<2.0.0' 'hyperopt<0.2' 'networkx<2.0' 'git+https://github.com/stanford-oval/mycroft-precise' && rm -fr /root/.cache

RUN mkdir /opt/almond
COPY . /opt/almond
RUN rm -rf /opt/almond/node_modules
WORKDIR /opt/almond
# we need python2 to run node-gyp...
# to avoid having it in the final image or in any layer, we install it, use it, and then remove it again
RUN dnf -y install python2 && PYTHON=/usr/bin/python2 yarn && dnf -y remove python2 && rm -fr /root/.cache

EXPOSE 3000
ENV THINGENGINE_HOME=/var/lib/almond-server
ENV PULSE_SOCKET=unix:/run/pulse/native

ENTRYPOINT [ "yarn", "start"]
