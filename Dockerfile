# build environments

# website
FROM node:10.15.2-alpine as websitebuilder
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app/package.json
RUN npm install --silent
COPY . /usr/src/app
RUN npm run build

# socket-server
FROM alpine:latest as crystalbuilder
RUN echo '@edge http://dl-cdn.alpinelinux.org/alpine/edge/community' >> /etc/apk/repositories \
    && apk add --update --no-cache --force-overwrite \
        crystal@edge \
        g++ \
        gc-dev \
        libevent-dev \
        libunwind-dev \
        libxml2-dev \
        llvm \
        llvm-dev \
        llvm-libs \
        llvm-static \
        make \
        musl-dev \
        openssl-dev \
        pcre-dev \
        readline-dev \
        shards@edge \
        yaml-dev \
        zlib-dev

ADD ./socket-server /src
WORKDIR /src
RUN shards build --production --static

# production environment

FROM nginx:1.13.9-alpine
RUN apk add --no-cache --update --force-overwrite \
	bash \
	supervisor

RUN rm -rf /tmp/* /var/cache/apk/*

ADD ./supervisord.conf /etc/

COPY --from=websitebuilder /usr/src/app/build /usr/share/nginx/html
COPY --from=crystalbuilder /src/bin/socket-server /app/socket-server

EXPOSE 80 3000

# TODO Kemal still says it lives in dev. land, make kemal prod.

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
