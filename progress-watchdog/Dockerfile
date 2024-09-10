FROM --platform=$BUILDPLATFORM golang:1.22 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN go mod download
COPY main.go main.go
COPY internal/ internal/
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build
RUN chmod +x progress-watchdog

FROM gcr.io/distroless/static:nonroot
COPY --from=builder --chown=nonroot:nonroot /src/progress-watchdog /progress-watchdog
ENV GIN_MODE=release
CMD ["/progress-watchdog"]
