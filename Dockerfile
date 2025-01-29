FROM node:23-alpine AS runtime
WORKDIR /app

COPY ./site .

RUN npm install
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=80
EXPOSE 80
CMD node ./dist/server/entry.mjs