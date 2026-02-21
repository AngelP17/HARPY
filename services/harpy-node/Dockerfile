FROM rust:1.82 AS builder
WORKDIR /app
COPY . .
RUN cargo build -p harpy-node --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/harpy-node /app/harpy-node
ENV NODE_PORT=8080
EXPOSE 8080
CMD ["/app/harpy-node"]
