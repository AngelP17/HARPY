.PHONY: help test lint fmt core web web-build dev serve ingest export check clean

DB ?= data/harpy.sqlite

help:
	@echo "HARPY"
	@echo "  make test        Rust + web unit/integration tests (recorded real-source fixtures)"
	@echo "  make lint        cargo fmt --check, clippy -D warnings, tsc, eslint"
	@echo "  make ingest      One real ingestion cycle into $(DB) (needs internet)"
	@echo "  make export      Write data/v1 documents from $(DB) into apps/web/public/data"
	@echo "  make dev         Next dev server reading apps/web/public/data"
	@echo "  make serve       harpy-core live server + built web on 127.0.0.1:8080"
	@echo "  make check       Database integrity check"

test:
	cargo test -p harpy-core --locked
	npm --workspace apps/web test

lint:
	cargo fmt --all -- --check
	cargo clippy -p harpy-core --all-targets --locked -- -D warnings
	npm --workspace apps/web run typecheck
	npm --workspace apps/web run lint

core:
	cargo build --release -p harpy-core --locked

ingest: core
	./target/release/harpy-core ingest --db $(DB)

export: core
	./target/release/harpy-core export --db $(DB) --out apps/web/public

check: core
	./target/release/harpy-core check --db $(DB)

dev: export
	npm --workspace apps/web run dev

web-build:
	rm -rf apps/web/public/data # the live server renders data/v1 itself
	NEXT_PUBLIC_BASE_PATH= npm --workspace apps/web run build
	node apps/web/scripts/check-no-mocks.mjs apps/web/out

serve: core web-build
	./target/release/harpy-core serve --db $(DB) --bind 127.0.0.1:8080 --web apps/web/out

clean:
	cargo clean
	rm -rf apps/web/.next apps/web/out apps/web/public/cesium apps/web/public/data
