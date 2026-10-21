# Live-server deployment: harpy-core (scheduler + read-only API) serving the static web build.
# Build from the repo root:  docker build -f deploy/Dockerfile -t harpy .

FROM rust:1-bookworm AS core
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY services ./services
COPY tests ./tests
RUN cargo build --release -p harpy-core --locked

FROM node:22-bookworm-slim AS web
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
ENV NEXT_PUBLIC_BASE_PATH="" NEXT_TELEMETRY_DISABLED=1
RUN rm -rf apps/web/public/data \
 && npm --workspace apps/web run build \
 && node apps/web/scripts/check-no-mocks.mjs apps/web/out

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 harpy && mkdir /data && chown harpy /data
COPY --from=core /src/target/release/harpy-core /usr/local/bin/harpy-core
COPY --from=web /src/apps/web/out /app/web
USER harpy
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS http://127.0.0.1:8080/ready || exit 1
ENTRYPOINT ["harpy-core", "serve", "--db", "/data/harpy.sqlite", "--bind", "0.0.0.0:8080", "--web", "/app/web"]
