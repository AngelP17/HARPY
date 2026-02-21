FROM rust:1.88-slim AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml ./
COPY crates ./crates
COPY services ./services
COPY proto ./proto

# Build the service
RUN cargo build --release -p harpy-ingest

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/harpy-ingest /usr/local/bin/harpy-ingest

EXPOSE 8081

CMD ["harpy-ingest"]
