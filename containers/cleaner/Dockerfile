FROM --platform=$BUILDPLATFORM docker.io/golang:1.26 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY cmd/cleaner ./cmd/cleaner
COPY internal ./internal
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 \
    go build -o /out/cleaner ./cmd/cleaner
RUN chmod +x /out/cleaner

FROM gcr.io/distroless/static:nonroot
COPY --from=builder --chown=root:root --chmod=755 /out/cleaner /cleaner
CMD ["/cleaner"]
