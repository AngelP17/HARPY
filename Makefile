.PHONY: help dev-up dev-up-offline dev-up-online dev-status dev-logs dev-down dev-health lint test build perf-check proto clean

COMPOSE ?= docker compose
BACKEND_SERVICES ?= postgres redis minio harpy-relay harpy-ingest harpy-fusion harpy-graph harpy-aip
OFFLINE_ENV_FILE ?= .env.offline
ONLINE_ENV_FILE ?= .env.online

help:
	@echo "HARPY Development Commands"
	@echo ""
	@echo "  make dev-up               - Start full backend stack in offline mode (default)"
	@echo "  make dev-up-offline       - Start full backend stack with mock/offline providers"
	@echo "  make dev-up-online        - Start full backend stack with real online providers"
	@echo "  make dev-status           - Show compose service status"
	@echo "  make dev-logs             - Follow backend logs"
	@echo "  make dev-health           - Check backend health endpoints"
	@echo "  make dev-down             - Stop local docker compose stack"
	@echo "  make lint         - Run Clippy linter"
	@echo "  make test         - Run all tests"
	@echo "  make build        - Build all services in release mode"
	@echo "  make perf-check   - Check build performance"
	@echo "  make proto        - Generate protobuf code"
	@echo "  make clean        - Clean build artifacts"

dev-up: dev-up-offline

dev-up-offline:
	$(COMPOSE) --env-file $(OFFLINE_ENV_FILE) up -d $(BACKEND_SERVICES)
	$(MAKE) dev-health
	@echo "Offline backend stack is ready."
	@echo "Frontend (offline/hybrid): cd apps/web && npm run dev:offline"

dev-up-online:
	$(COMPOSE) --env-file $(ONLINE_ENV_FILE) up -d $(BACKEND_SERVICES)
	$(MAKE) dev-health
	@echo "Online backend stack is ready."
	@echo "Frontend (online): cd apps/web && npm run dev:online"

dev-status:
	$(COMPOSE) ps

dev-logs:
	$(COMPOSE) logs -f --tail=200 $(BACKEND_SERVICES)

dev-health:
	@echo "Checking backend health endpoints..."
	@for url in \
		http://localhost:8080/health \
		http://localhost:8081/health \
		http://localhost:8082/health \
		http://localhost:8083/health \
		http://localhost:8084/health ; do \
		printf "  %s ... " "$$url"; \
		attempt=0; \
		until curl -fsS "$$url" > /dev/null; do \
			attempt=$$((attempt + 1)); \
			if [ $$attempt -ge 30 ]; then \
				echo "failed"; \
				exit 1; \
			fi; \
			sleep 2; \
		done; \
		echo "ok"; \
	done

dev-down:
	$(COMPOSE) down

lint:
	@echo "Running Clippy..."
	cargo clippy --all-targets --all-features -- -D warnings

test:
	@echo "Running Rust tests..."
	cargo test --all-features

build:
	@echo "Building all services in release mode..."
	cargo build --release

perf-check:
	@echo "Checking build performance..."
	@echo "--- Binary sizes ---"
	@ls -lh target/release/harpy-* 2>/dev/null | grep -v '.d' || echo "No binaries found. Run 'make build' first."
	@echo ""
	@echo "--- Build time (clean build) ---"
	@echo "Cleaning..."
	@cargo clean
	@echo "Building..."
	@time cargo build --release --quiet

proto:
	@echo "Generating protobuf code..."
	@cd crates/harpy-proto && cargo build

clean:
	cargo clean
	$(COMPOSE) down -v
