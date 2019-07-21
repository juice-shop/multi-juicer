FROM golang:1.12-alpine AS builder

RUN apk add git

WORKDIR /src

COPY . .
RUN go build
RUN chmod +x progress-watchdog

FROM alpine

RUN addgroup -S app && adduser app -S -G app

COPY --from=builder --chown=app:app /src/progress-watchdog /home/app/progress-watchdog

USER app

CMD /home/app/progress-watchdog
