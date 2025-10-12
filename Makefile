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


load-test-data: start-backend ## load test data
	cd ./backend && yarn commands load-crosswords
	cd ./backend && yarn commands load-test-data

find-local-ip-mac: ## finds the local IP address so you can update the EXPO_PUBLIC_API_BASE_URL value in the .env.local file.
	 ipconfig getifaddr en0

build-android-dev: #creates a new eas build for android
	cd frontend && eas build --platform android --profile development

create: ## set up the project
	yarn install


OPEN_CMD = $(shell which xdg-open 2>/dev/null || which open 2>/dev/null || echo "start")
ssh-prod: ## gain a shell on the production enviroment to run migrations and reports
	@echo "🌐 Opening Railway CLI SSH guide..."
	@$(OPEN_CMD) "https://docs.railway.com/guides/cli#ssh"
