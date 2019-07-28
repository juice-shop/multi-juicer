FROM node:12-alpine as build
RUN mkdir -p /home/app
WORKDIR /home/app
COPY package.json package-lock.json ./
RUN npm ci --production

FROM node:12-alpine
RUN addgroup -S app && adduser app -S -G app
WORKDIR /home/app/
COPY --from=build --chown=app:app /home/app/node_modules/ ./node_modules/
COPY --chown=app:app ./src src/
USER app
EXPOSE 8080
CMD ["node", "/home/app/src/main.js"]