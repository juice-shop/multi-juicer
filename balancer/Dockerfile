ARG JUICE_SHOP_VERSION=latest

FROM --platform=$BUILDPLATFORM docker.io/golang:1.25 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY --exclude=ui . .
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build
RUN chmod +x balancer

FROM --platform=$BUILDPLATFORM docker.io/library/node:24-alpine AS ui
RUN mkdir -p /home/app
WORKDIR /home/app
COPY ui/package.json ui/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts
COPY ui/ ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/home/app/node_modules/.vite \
    npm run build

# get the challenges from the juice-shop image
FROM docker.io/bkimminich/juice-shop:${JUICE_SHOP_VERSION} AS juice-shop
# convert them to json so that we don't need to pull in a yaml lib
FROM docker.io/mikefarah/yq:4 AS challenges-json
COPY --from=juice-shop /juice-shop/data/static/challenges.yml /workdir/challenges.yaml
RUN yq eval --output-format json '.' /workdir/challenges.yaml > /workdir/challenges.json

FROM gcr.io/distroless/static:nonroot
COPY --from=challenges-json --chown=root:root --chmod=755 /workdir/challenges.json /challenges.json
COPY --from=ui --chown=root:root --chmod=755 /home/app/build/ /public/
COPY --from=builder --chown=root:root --chmod=755 /src/balancer /balancer
CMD ["/balancer"]
