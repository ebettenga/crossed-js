.PHONY: help
help: ## display this help screen
	@grep -E '^[a-z.A-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

start-backend: ## spin up the supabase instance
	cd ./backend && yarn install
	cd ./backend && docker compose up -d db redis worker
	cd ./backend && yarn dev


start-frontend: ## start the dev server
	cd ./frontend && yarn install
	cd ./frontend && npx expo start


load-crosswords: start-backend ## load test data
	cd ./backend && yarn commands load-crosswords

find-local-ip-mac: ## finds the local IP address so you can update the EXPO_PUBLIC_API_BASE_URL value in the .env.local file.
	 ipconfig getifaddr en0

build-android-dev: #creates a new eas build for android
	cd frontend && eas build --platform android --profile development

create: ## set up the project
	yarn install


OPEN_CMD = $(shell which xdg-open 2>/dev/null || which open 2>/dev/null || echo "start")
ssh-prod: ## gain a shell on the production enviroment to run migrations and reports
	@echo "🌐 Opening Railway CLI SSH channel..."
	railway ssh --project=3a25f6b6-cba4-4467-b74c-61968cb4b93f --environment=5da76b23-4abb-439d-8a41-b06808f52c64 --service=541b5b15-5c8f-4526-b922-7a5adb320b0d

report-prod: ## gain a shell on the production enviroment to run migrations and reports
	@echo "Installing yarn dev depencencies in production enviroment..."
	railway ssh --project=3a25f6b6-cba4-4467-b74c-61968cb4b93f --environment=5da76b23-4abb-439d-8a41-b06808f52c64 --service=541b5b15-5c8f-4526-b922-7a5adb320b0d -- yarn --production=false
		@echo "📊 Opening Railway CLI SSH channel for report..."
	railway ssh --project=3a25f6b6-cba4-4467-b74c-61968cb4b93f --environment=5da76b23-4abb-439d-8a41-b06808f52c64 --service=541b5b15-5c8f-4526-b922-7a5adb320b0d -- yarn commands report

report: ## alias to run a report command
	cd backend && yarn commands report

.PHONY: coverage
coverage: ## serve backend coverage report on port 3476
	cd backend/coverage/lcov-report && python3 -m http.server 3476 >/tmp/backend-coverage.log 2>&1 &
	sleep 1
	@echo "Coverage server running on http://127.0.0.1:3476 (logs: /tmp/backend-coverage.log)"
	@$(OPEN_CMD) "http://127.0.0.1:3476"

.PHONY: tests
tests: ## run backend test suite (skips sockets route tests; they leak connections)
	@echo "Skipping tests/routes/sockets.route.test.ts (known to leave connections open)."
	cd backend && yarn test --detectOpenHandles --forceExit

.PHONY: count
count: ## count the number of lines in the project. assumes you have cloc installed (brewe.g. brew install cloc)
	@echo "Counting lines in the project..."
	cloc . --exclude-dir=node_modules,android,ios,crosswords
