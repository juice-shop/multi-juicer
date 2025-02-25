ARG JUICE_SHOP_VERSION=latest

FROM --platform=$BUILDPLATFORM docker.io/golang:1.24 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN go mod download
COPY . .
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build
RUN chmod +x balancer

FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
RUN mkdir -p /home/app
WORKDIR /home/app
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# get the challenges from the juice-shop image
FROM bkimminich/juice-shop:${JUICE_SHOP_VERSION} AS juice-shop
# convert them to json so that we don't need to pull in a yaml lib
FROM mikefarah/yq:4 AS challenges-json
COPY --from=juice-shop /juice-shop/data/static/challenges.yml /workdir/challenges.yaml
RUN yq eval --output-format json '.' /workdir/challenges.yaml > /workdir/challenges.json

FROM gcr.io/distroless/static:nonroot
COPY --from=challenges-json --chown=nonroot:nonroot /workdir/challenges.json /challenges.json
COPY --from=ui --chown=nonroot:nonroot /home/app/build/ /public/
COPY --from=builder --chown=nonroot:nonroot /src/balancer /balancer
CMD ["/balancer"]
