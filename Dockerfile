# build environments

# website
FROM node:10.15.2-alpine as websitebuilder

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/package.json
RUN npm install --silent

COPY . /usr/src/app
COPY .env.dist /usr/src/app/.env

RUN npm run build

# socket-server
FROM alpine:3.10 as crystalbuilder
RUN echo '@edge http://dl-cdn.alpinelinux.org/alpine/edge/community' >> /etc/apk/repositories
RUN echo '@edge http://dl-cdn.alpinelinux.org/alpine/edge/main' >> /etc/apk/repositories
RUN apk add --update --no-cache --force-overwrite \
        crystal@edge \
        g++ \
        gc-dev \
        libunwind-dev \
        libxml2-dev \
        llvm8 \
        llvm8-dev \
        llvm8-libs \
        llvm8-static \
        make \
        musl-dev \
        openssl-dev \
        pcre-dev \
        readline-dev \
        shards@edge \
        yaml-dev \
        zlib-dev

ADD ./socket-server /src
COPY .env.dist /src/.env

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
