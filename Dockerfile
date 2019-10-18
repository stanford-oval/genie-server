FROM ubuntu:16.04

# Install sudo, git, curl, libpulse, and https sources support
RUN apt-get update
RUN apt-get -y install software-properties-common git curl apt-transport-https ca-certificates libpulse-dev

# Install pcre2
RUN apt-get install -y libpcre2-dev libpcre2-8-0 pcre2-utils

# Install mimic
RUN add-apt-repository -y ppa:mycroft-ai/mycroft-ai
RUN apt-get update
RUN apt-get install -y mimic 
# Install nodejs
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs

# Install Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update && apt-get -y install yarn

# Create necessary directories in root
RUN mkdir /root/.cache /root/.config

RUN mkdir /opt/almond
COPY . /opt/almond
RUN rm -rf /opt/almond/node_modules
WORKDIR /opt/almond
RUN yarn

EXPOSE 3000

ENTRYPOINT [ "yarn", "start"]