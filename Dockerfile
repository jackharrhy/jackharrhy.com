# build
FROM crystallang/crystal:1.0.0-alpine-build as build

WORKDIR /build

COPY shard.yml /build/
COPY shard.lock /build/

RUN mkdir src
COPY ./src /build/src

RUN shards --ignore-crystal-version
RUN shards build site --release --static

# prod
FROM alpine:3

WORKDIR /app

COPY ./.env.dist /app/.env
COPY --from=build /build/bin/site /app/site

RUN mkdir public
COPY ./public /app/public

EXPOSE 3000
CMD ["/app/site"]
