SHELL := /bin/bash
PROFILE_COMPOSE ?= tests/profiling/docker-compose.yml

.PHONY: profile
profile:
	@if [ ! -f tests/profiling/.env ]; then \
	  echo "tests/profiling/.env is missing. Copy .env.example and populate credentials first."; \
	  exit 1; \
	fi
	docker compose -f $(PROFILE_COMPOSE) up --build --abort-on-container-exit profiler; \
	docker compose -f $(PROFILE_COMPOSE) down --remove-orphans

.PHONY: profile-test-room
profile-test-room: profile
