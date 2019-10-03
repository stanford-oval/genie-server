FROM ubuntu:16.04

RUN mkdir /almond
COPY . /almond

# Install sudo, git, curl, libpulse, and https sources support
RUN apt-get update && apt-get -y install sudo
RUN sudo apt-get -y install software-properties-common git curl apt-transport-https ca-certificates libpulse-dev

# Install pcre2
RUN sudo apt-get install -y libpcre2-dev libpcre2-8-0 pcre2-utils

# Install mimic
RUN sudo add-apt-repository -y ppa:mycroft-ai/mycroft-ai
RUN sudo apt-get update
RUN sudo apt-get install -y mimic

# Install nodejs
RUN curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
RUN sudo apt-get install -y nodejs

# Install Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
RUN sudo apt-get update && sudo apt-get -y install yarn

RUN yarn

# Create necessary directories in root
RUN mkdir /root/.cache /root/.config

EXPOSE 3000
