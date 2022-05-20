FROM golang:1.18 as builder
WORKDIR /src
COPY go.mod go.sum ./
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN go mod download
COPY main.go main.go
COPY internal/ internal/
ENV CGO_ENABLED 0
RUN go build
RUN chmod +x progress-watchdog

FROM gcr.io/distroless/static:nonroot
COPY --from=builder --chown=nonroot:nonroot /src/progress-watchdog /progress-watchdog
ENV GIN_MODE=release
CMD ["/progress-watchdog"]
