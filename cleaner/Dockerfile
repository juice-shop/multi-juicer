FROM node:22-alpine AS build
RUN mkdir -p /home/app
WORKDIR /home/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN addgroup --system --gid 1001 app && adduser app --system --uid 1001 --ingroup app
WORKDIR /home/app/
COPY --from=build --chown=app:app /home/app/node_modules/ ./node_modules/
COPY --chown=app:app ./src src/
USER 1001
CMD ["node", "/home/app/src/main.js"]
