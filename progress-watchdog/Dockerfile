ARG JUICE_SHOP_VERSION=latest

FROM --platform=$BUILDPLATFORM docker.io/golang:1.25 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY main.go main.go
COPY internal/ internal/
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build
RUN chmod +x progress-watchdog

ARG JUICE_SHOP_VERSION=latest

# get the challenges from the juice-shop image
FROM docker.io/bkimminich/juice-shop:${JUICE_SHOP_VERSION} AS juice-shop
# convert them to json so that we don't need to pull in a yaml lib
FROM docker.io/mikefarah/yq:4 AS challenges-json
COPY --from=juice-shop /juice-shop/data/static/challenges.yml /workdir/challenges.yaml
RUN yq eval --output-format json '.' /workdir/challenges.yaml > /workdir/challenges.json

FROM gcr.io/distroless/static:nonroot
COPY --from=challenges-json --chown=root:root --chmod=755 /workdir/challenges.json /challenges.json
COPY --from=builder --chown=root:root --chmod=755 /src/progress-watchdog /progress-watchdog
CMD ["/progress-watchdog"]
