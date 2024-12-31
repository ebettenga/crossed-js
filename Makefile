.PHONY: help
help: ## display this help screen
	@grep -E '^[a-z.A-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

start-backend: ## spin up the supabase instance
	cd ./backend && yarn install
	cd ./backend && docker compose up -d db
	cd ./backend && yarn dev


start-frontend: ## start the dev server
	cd ./frontend && yarn install
	cd ./frontend && npx expo start

stop: ## stop the supabase container instances
	npx supabase stop

create: ## set up the project
	yarn install
	npx supabase start
	npx supabase migration up

upgrade: ## runs supabase migrations
	npx supabase migration up

reset: ## recreates local db. useful for testing migrations
	npx supabase db reset

edge-logs: ## show docker logs for edge runtime container
	docker logs supabase_edge_runtime_HOA_Map -f

edge-serve: ## serve your local supabase edge functions
	npx supabase functions serve
