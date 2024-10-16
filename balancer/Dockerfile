FROM --platform=$BUILDPLATFORM docker.io/golang:1.23 AS builder
WORKDIR /src
COPY go.mod ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN go mod download
COPY main.go main.go
COPY pkg/ pkg/
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build
RUN chmod +x balancer

FROM gcr.io/distroless/static:nonroot
COPY --from=builder --chown=nonroot:nonroot /src/balancer /balancer
ENV GIN_MODE=release
CMD ["/balancer"]
