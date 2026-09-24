FROM golang:1.24-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum* ./

RUN go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/engine ./cmd/server

FROM alpine:3.20

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/data/leveldb /tmp/ipc \
    && chown -R appuser:appgroup /app /tmp/ipc

COPY --from=builder /bin/engine /app/engine

USER appuser

EXPOSE 8080
EXPOSE 5140/udp

VOLUME ["/app/data/leveldb", "/tmp/ipc"]
ENTRYPOINT ["/app/engine"]
