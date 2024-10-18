FROM --platform=$BUILDPLATFORM docker.io/golang:1.23 AS builder
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

FROM gcr.io/distroless/static:nonroot
COPY --from=ui --chown=nonroot:nonroot /home/app/build/ /public/
COPY --from=builder --chown=nonroot:nonroot /src/balancer /balancer
CMD ["/balancer"]
