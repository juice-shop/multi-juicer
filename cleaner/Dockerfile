FROM --platform=$BUILDPLATFORM docker.io/golang:1.25 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY main.go main.go
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build
RUN chmod +x cleaner

FROM gcr.io/distroless/static:nonroot
COPY --from=builder --chown=root:root --chmod=755 /src/cleaner /cleaner
CMD ["/cleaner"]
