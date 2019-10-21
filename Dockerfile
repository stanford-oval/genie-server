FROM docker.io/fedora:30

# Install all deps in the standard repos
RUN dnf -y install git curl pulseaudio-libs-devel unzip nodejs mimic-devel

# Install yarn
RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo
RUN dnf -y install yarn

RUN mkdir /opt/almond
COPY . /opt/almond
RUN rm -rf /opt/almond/node_modules
WORKDIR /opt/almond
RUN yarn

EXPOSE 3000

ENTRYPOINT [ "yarn", "start"]
