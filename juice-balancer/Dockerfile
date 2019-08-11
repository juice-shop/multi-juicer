FROM node:12-alpine as build
RUN mkdir -p /home/app
WORKDIR /home/app
COPY package.json package-lock.json ./
RUN npm ci --production

FROM node:12-alpine as ui
RUN mkdir -p /home/app
WORKDIR /home/app
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

FROM node:12-alpine
ARG NODE_ENV
RUN addgroup -S app && adduser app -S -G app
WORKDIR /home/app/
COPY --from=build --chown=app:app /home/app/node_modules/ ./node_modules/
COPY --chown=app:app ./config config/
COPY --from=ui --chown=app:app /home/app/build/ ./public/
COPY --chown=app:app ./src src/
USER app
EXPOSE 8080
ENV NODE_ENV ${NODE_ENV:-production}
CMD ["node", "/home/app/src/index.js"]