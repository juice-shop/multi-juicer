FROM node:10-alpine as build

RUN mkdir -p /home/app

WORKDIR /home/app
COPY package.json package-lock.json ./

RUN npm ci --production

FROM node:10-alpine

RUN addgroup -S app && adduser app -S -G app

WORKDIR /home/app/

COPY --chown=app:app ./src src/
COPY --from=build --chown=app:app /home/app/node_modules/ ./node_modules/

USER app

EXPOSE 8080

CMD ["node", "/home/app/src/main.js"]