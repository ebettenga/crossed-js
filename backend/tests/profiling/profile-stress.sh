#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && cd ../.. && pwd)"
cd "$ROOT_DIR"

if [[ ! -d node_modules ]]; then
  echo "node_modules is missing. Run 'yarn install' before profiling." >&2
  exit 1
fi

AUTH_TOKEN="${AUTH_TOKEN:-}"
CREDENTIAL_FALLBACK="${PROFILE_TEST_CREDENTIAL:-${TEST_CREDENTIAL:-${PROFILE_TEST_USERNAME:-${TEST_USERNAME:-${PROFILE_TEST_EMAIL:-""}}}}}"
PASSWORD_FALLBACK="${PROFILE_TEST_PASSWORD:-${TEST_PASSWORD:-""}}"
PROFILE_BASE_URL="${PROFILE_BASE_URL:-http://localhost:3000/api}"
PROFILE_SIGNIN_PATH="${PROFILE_SIGNIN_PATH:-/signin}"

PORT="${PORT:-3000}"
PROFILE_DIR="${PROFILE_DIR:-$ROOT_DIR/profiles}"
PROFILE_ENTRY="${PROFILE_ENTRY:-./src/index.ts}"
PROFILE_LABEL="${PROFILE_LABEL:-rooms-stress}"
INSPECT_TARGET="${INSPECT_TARGET:-127.0.0.1:9229}"
PROFILE_USE_DOCKER="${PROFILE_USE_DOCKER:-0}"
PROFILE_DOCKER_COMPOSE_FILE="${PROFILE_DOCKER_COMPOSE_FILE:-./tests/profiling/docker-compose.yml}"
PROFILE_DOCKER_SERVICES="${PROFILE_DOCKER_SERVICES:-redis db api}"
PROFILE_DOCKER_DOWN="${PROFILE_DOCKER_DOWN:-1}"

ROOM_ID="${ROOM_ID:-${PROFILE_TEST_ROOM_ID:-62}}"
GUESS_X="${GUESS_X:-0}"
GUESS_Y="${GUESS_Y:-1}"
GUESS_CHAR="${GUESS_CHAR:-d}"

HTTP_CONCURRENCY="${HTTP_CONCURRENCY:-20}"
HTTP_DURATION_MS="${HTTP_DURATION_MS:-30000}"
LEADERBOARD_CONCURRENCY="${LEADERBOARD_CONCURRENCY:-10}"
LEADERBOARD_DURATION_MS="${LEADERBOARD_DURATION_MS:-20000}"

WS_CLIENTS="${WS_CLIENTS:-25}"
WS_GUESSES_PER_CLIENT="${WS_GUESSES_PER_CLIENT:-20}"
WS_GUESS_INTERVAL_MS="${WS_GUESS_INTERVAL_MS:-200}"
WS_CLIENT_TIMEOUT_MS="${WS_CLIENT_TIMEOUT_MS:-60000}"
WS_EVENT="${WS_EVENT:-guess}"

HTTP_GUESS_ENDPOINT="${HTTP_GUESS_ENDPOINT:-/api/rooms/${ROOM_ID}}"
LEADERBOARD_ENDPOINT="${LEADERBOARD_ENDPOINT:-/api/leaderboard}"
BASE_HTTP_URL="${BASE_HTTP_URL:-${PROFILE_HTTP_ORIGIN:-http://localhost:${PORT}}}"
BASE_WS_URL="${BASE_WS_URL:-${PROFILE_SOCKET_URL:-ws://localhost:${PORT}}}"

mkdir -p "$PROFILE_DIR"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "Stopping profiled server (PID $SERVER_PID)..."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi

  if [[ "${PROFILE_DOCKER_STARTED:-0}" == "1" && "$PROFILE_DOCKER_DOWN" == "1" ]]; then
    echo "Stopping docker services (${PROFILE_DOCKER_SERVICES})..."
    PROFILE_NODE_OPTIONS="${PROFILE_NODE_OPTIONS:-}" docker compose -f "$PROFILE_DOCKER_COMPOSE_FILE" down >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_port() {
  local host=$1
  local port=$2
  local timeout=${3:-60}
  local start
  start=$(date +%s)

  echo "Waiting for ${host}:${port}..."
  while true; do
    if (exec 3<>"/dev/tcp/${host}/${port}") >/dev/null 2>&1; then
      exec 3>&- 3<&-
      break
    fi
    if (( $(date +%s) - start >= timeout )); then
      echo "Timed out waiting for ${host}:${port}" >&2
      return 1
    fi
    sleep 1
  done
  echo "Port ${port} is accepting connections."
}

build_guess_body() {
  ROOM_ID="$ROOM_ID" GUESS_X="$GUESS_X" GUESS_Y="$GUESS_Y" GUESS_CHAR="$GUESS_CHAR" node - <<'NODE'
const roomId = Number(process.env.ROOM_ID ?? 0);
const x = Number(process.env.GUESS_X ?? 0);
const y = Number(process.env.GUESS_Y ?? 0);
const guess = process.env.GUESS_CHAR ?? "d";
const payload = {
  roomId,
  x,
  y,
  coordinates: { x, y },
  guess,
};
process.stdout.write(JSON.stringify(payload));
NODE
}

run_http_load() {
  local name=$1
  local url=$2
  local method=$3
  local body=$4
  local concurrency=$5
  local duration=$6
  local expected_status=${7:-}
  echo "==> HTTP load (${name}): ${url}"
  HTTP_NAME="$name" \
  HTTP_TARGET="$url" \
  HTTP_METHOD="$method" \
  HTTP_BODY="$body" \
  HTTP_CONCURRENCY="$concurrency" \
  HTTP_DURATION_MS="$duration" \
  HTTP_EXPECTED_STATUS="$expected_status" \
  EXTRA_HEADERS='{}' \
  AUTH_TOKEN="$AUTH_TOKEN" \
  node ./tests/profiling/http-stress.mjs
}

run_ws_load() {
  echo "==> Websocket load (guess event via Socket.IO)"
  WS_URL="$BASE_WS_URL" \
  WS_PATH="${WS_PATH:-/socket.io}" \
  WS_CLIENTS="$WS_CLIENTS" \
  WS_GUESSES_PER_CLIENT="$WS_GUESSES_PER_CLIENT" \
  WS_GUESS_INTERVAL_MS="$WS_GUESS_INTERVAL_MS" \
  WS_CLIENT_TIMEOUT_MS="$WS_CLIENT_TIMEOUT_MS" \
  ROOM_ID="$ROOM_ID" \
  GUESS_X="$GUESS_X" \
  GUESS_Y="$GUESS_Y" \
  GUESS_CHAR="$GUESS_CHAR" \
  WS_EVENT="$WS_EVENT" \
  AUTH_TOKEN="${WS_AUTH_TOKEN:-$AUTH_TOKEN}" \
  node ./tests/profiling/ws-guess-load.mjs
}

HTTP_GUESS_BODY="$(build_guess_body)"

if [[ "$PROFILE_USE_DOCKER" == "1" ]]; then
  echo "Launching dockerized infra: ${PROFILE_DOCKER_SERVICES}"
  PROFILE_DOCKER_STARTED=1
  PROFILE_NODE_OPTIONS_VALUE="${PROFILE_NODE_OPTIONS:-"--inspect=0.0.0.0:9229 --cpu-prof --cpu-prof-dir=/app/profiles --cpu-prof-name=${PROFILE_LABEL}"}"
  PROFILE_NODE_OPTIONS="$PROFILE_NODE_OPTIONS_VALUE" docker compose -f "$PROFILE_DOCKER_COMPOSE_FILE" up -d --build $PROFILE_DOCKER_SERVICES
else
  echo "Launching backend with CPU profiling..."
  NODE_ENV="${NODE_ENV:-production}" \
  NODE_OPTIONS="--inspect=${INSPECT_TARGET} --cpu-prof --cpu-prof-dir=${PROFILE_DIR} --cpu-prof-name=${PROFILE_LABEL}" \
  ./node_modules/.bin/tsx "$PROFILE_ENTRY" &
  SERVER_PID=$!
fi

wait_for_port "127.0.0.1" "$PORT" 120

if [[ -z "$AUTH_TOKEN" && -n "$CREDENTIAL_FALLBACK" && -n "$PASSWORD_FALLBACK" ]]; then
  echo "Requesting auth token for ${CREDENTIAL_FALLBACK}..."
  AUTH_TOKEN="$(
    PROFILE_TEST_CREDENTIAL="$CREDENTIAL_FALLBACK" \
    PROFILE_TEST_PASSWORD="$PASSWORD_FALLBACK" \
    PROFILE_BASE_URL="$PROFILE_BASE_URL" \
    PROFILE_SIGNIN_PATH="$PROFILE_SIGNIN_PATH" \
    PROFILE_OUTPUT="token" \
    node "$ROOT_DIR/tests/profiling/login.mjs"
  )"
fi

if [[ -z "$AUTH_TOKEN" ]]; then
  echo "AUTH_TOKEN env var is required (set it directly or provide PROFILE_TEST_CREDENTIAL/PROFILE_TEST_PASSWORD)." >&2
  exit 1
fi

run_http_load "guess" "${BASE_HTTP_URL}${HTTP_GUESS_ENDPOINT}" "POST" "$HTTP_GUESS_BODY" "$HTTP_CONCURRENCY" "$HTTP_DURATION_MS"
run_http_load "leaderboard" "${BASE_HTTP_URL}${LEADERBOARD_ENDPOINT}" "GET" "" "$LEADERBOARD_CONCURRENCY" "$LEADERBOARD_DURATION_MS"
run_ws_load

cleanup
trap - EXIT

LATEST_PROFILE="$(ls -1t "${PROFILE_DIR}"/*.cpuprofile 2>/dev/null | head -n 1 || true)"
if [[ -n "$LATEST_PROFILE" ]]; then
  echo "CPU profile saved to: $LATEST_PROFILE"
  echo "Open it in Chrome DevTools Performance tab or speedscope.dev for a flamegraph."
else
  echo "No CPU profile file was detected in ${PROFILE_DIR}."
fi
