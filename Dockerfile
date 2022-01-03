FROM node:alpine AS builder

WORKDIR /opt/mx-puppet-voipms

# run build process as user in case of npm pre hooks
# pre hooks are not executed while running as root
RUN chown node:node /opt/mx-puppet-voipms
RUN apk --no-cache add git python3 make g++ pkgconfig \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

RUN wget -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub && \
    wget -O glibc-2.32-r0.apk https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.32-r0/glibc-2.32-r0.apk && \
    apk add glibc-2.32-r0.apk

COPY package.json yarn.lock ./
RUN chown node:node package.json yarn.lock

USER node

RUN yarn install

COPY tsconfig.json ./
COPY src/ ./src/
RUN yarn run build


FROM node:alpine

VOLUME /data

ENV CONFIG_PATH=/data/config.yaml \
    REGISTRATION_PATH=/data/voipms-registration.yaml

# su-exec is used by docker-run.sh to drop privileges
RUN apk add --no-cache su-exec \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype


WORKDIR /opt/mx-puppet-voipms
COPY docker-run.sh ./
COPY --from=builder /opt/mx-puppet-voipms/node_modules/ ./node_modules/
COPY --from=builder /opt/mx-puppet-voipms/build/ ./build/

# change workdir to /data so relative paths in the config.yaml
# point to the persisten volume
WORKDIR /data
ENTRYPOINT ["/opt/mx-puppet-voipms/docker-run.sh"]