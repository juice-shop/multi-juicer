FROM node:16-alpine as build
RUN mkdir -p /home/app
WORKDIR /home/app
COPY package.json package-lock.json ./
RUN which npm
RUN ls
RUN npm help
RUN npm ci --production

FROM node:16-alpine
RUN addgroup --system --gid 1001 app && adduser app --system --uid 1001 --ingroup app
WORKDIR /home/app/
COPY --from=build --chown=app:app /home/app/node_modules/ ./node_modules/
COPY --chown=app:app ./src src/
USER 1001
CMD ["node", "/home/app/src/main.js"]
