FROM docker.io/fedora:33

# Install all deps in the standard repos
RUN dnf -y module install nodejs:12 && \
    dnf -y install git curl pulseaudio-libs-devel zip unzip nodejs make \
                   gcc gcc-c++ gettext libcanberra-devel atlas-devel blas-devel \
                   python2 findutils wget

RUN mkdir /opt/almond

RUN useradd almond && \
   chown almond:almond /opt/almond
USER almond
COPY --chown=almond:almond . /opt/almond
WORKDIR /opt/almond

# snowboy doesn't like building in docker, due to overlayfs bugs
RUN rm -rf /opt/almond/node_modules && \
    npm ci && \
    npm install --no-package-lock --ignore-scripts snowboy && \
    cd node_modules/snowboy/ && \
    PYTHON=python2 npx node-pre-gyp clean configure && \
    make -C build/ && \
    rm -fr /home/almond/.cache && \
    rm -fr /home/almond/.npm

RUN mkdir /home/almond/.cache

ENV HOME /home/almond
# switch back to root user so we can access the pulseaudio socker
USER root

EXPOSE 3000
ENV THINGENGINE_HOME=/var/lib/almond-server
ENV PULSE_SOCKET=unix:/run/pulse/native

ENTRYPOINT ["npm", "start"]
