FROM node:22-alpine AS build
RUN mkdir -p /home/app
WORKDIR /home/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
RUN mkdir -p /home/app
WORKDIR /home/app
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

FROM node:22-alpine
ARG NODE_ENV
RUN addgroup --system --gid 1001 app && adduser app --system --uid 1001 --ingroup app
WORKDIR /home/app/
COPY --from=build --chown=app:app /home/app/node_modules/ ./node_modules/
COPY --chown=app:app ./config config/
COPY --from=ui --chown=app:app /home/app/build/ ./public/
COPY --chown=app:app ./src src/
USER 1001
EXPOSE 8080
ENV NODE_ENV ${NODE_ENV:-production}
CMD ["node", "/home/app/src/index.js"]