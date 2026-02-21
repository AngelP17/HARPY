FROM rust:1.75 AS builder
WORKDIR /workspace
COPY . .
RUN cargo build -p harpy-node --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /workspace/target/release/harpy-node /app/harpy-node
ENV NODE_PORT=8080
EXPOSE 8080
CMD ["/app/harpy-node"]
