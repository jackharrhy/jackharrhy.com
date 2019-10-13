FROM node:10-alpine as websitebuilder

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/package.json
RUN npm install --silent

COPY . /usr/src/app

RUN npm run build

FROM nginx:alpine

COPY --from=websitebuilder /usr/src/app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
