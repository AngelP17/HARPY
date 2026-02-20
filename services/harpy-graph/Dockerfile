FROM rust:1.88-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY services ./services
COPY proto ./proto

RUN cargo build --release -p harpy-graph

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/harpy-graph /usr/local/bin/harpy-graph

EXPOSE 8083

CMD ["harpy-graph"]
