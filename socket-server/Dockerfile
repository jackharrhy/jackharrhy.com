FROM alpine:latest as builder

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

ADD . /src
WORKDIR /src
RUN shards build --production --static

FROM alpine:latest

COPY --from=builder /src/bin/socket-server /app/socket-server

EXPOSE 3000

# TODO Kemal still says it lives in dev. land, make kemal prod.

ENTRYPOINT ["/app/socket-server"]
