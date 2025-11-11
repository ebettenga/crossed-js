#!/usr/bin/env bash
set -euo pipefail

cd /app

PROFILE_BASE_URL="${PROFILE_BASE_URL:-http://api:3000/api}"
PROFILE_HTTP_ORIGIN="${PROFILE_HTTP_ORIGIN:-http://api:3000}"
PROFILE_SOCKET_URL="${PROFILE_SOCKET_URL:-ws://api:3000}"
PROFILE_SIGNIN_PATH="${PROFILE_SIGNIN_PATH:-/signin}"
PROFILE_RESULTS_DIR="${PROFILE_RESULTS_DIR:-/results}"
PROFILE_RAW_DIR="${PROFILE_RAW_DIR:-/app/profiles}"
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
WS_PATH="${WS_PATH:-/socket.io}"

timestamp="$(date +%Y%m%d-%H%M%S)"
run_dir="${PROFILE_RESULTS_DIR}/run-${timestamp}"
mkdir -p "$run_dir"
echo "Run output will be stored in $run_dir"
rm -f "${PROFILE_RAW_DIR}"/*.cpuprofile 2>/dev/null || true
rm -f "${PROFILE_RAW_DIR}"/*.heapprofile 2>/dev/null || true
rm -f "${PROFILE_RAW_DIR}"/*.heapsnapshot 2>/dev/null || true
SEED_OUTPUT_PATH="${run_dir}/seed-output.json"

wait_for_port() {
  local host=$1
  local port=$2
  local timeout=${3:-120}
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

call_endpoint() {
  local endpoint="$1"
  local method="${2:-POST}"
  ENDPOINT="$endpoint" METHOD="$method" node - <<'NODE'
const url = process.env.ENDPOINT;
const method = process.env.METHOD || "POST";
if (!url) {
  console.error("Endpoint not defined");
  process.exit(1);
}
(async () => {
  try {
    const response = await fetch(url, { method });
    const text = await response.text();
    if (text) {
      try {
        console.log(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        console.log(text);
      }
    }
    if (!response.ok) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Endpoint request failed:", error);
    process.exit(1);
  }
})();
NODE
}

wait_for_artifact() {
  local pattern="$1"
  local label="$2"
  local attempts="${3:-10}"
  local delay="${4:-1}"
  for ((i = 0; i < attempts; i++)); do
    if compgen -G "$pattern" >/dev/null; then
      echo "$label detected"
      return 0;
    fi
    sleep "$delay"
  done
  echo "Timed out waiting for $label ($pattern)"
  return 1
}

wait_for_port "api" 3000 180

echo "Seeding database for profiling..."
NODE_ENV=production \
PGHOST="${PGHOST:-db}" \
PGPORT="${PGPORT:-5432}" \
PGUSER="${PGUSER:-postgres}" \
PGPASSWORD="${PGPASSWORD:-postgres}" \
POSTGRES_DB="${POSTGRES_DB:-crossed}" \
PROFILE_TEST_CREDENTIAL="${PROFILE_TEST_CREDENTIAL}" \
PROFILE_TEST_PASSWORD="${PROFILE_TEST_PASSWORD}" \
PROFILE_TEST_USERNAME="${PROFILE_TEST_USERNAME:-testuser}" \
PROFILE_TIME_TRIAL_ROOM_ID="${PROFILE_TIME_TRIAL_ROOM_ID:-}" \
PROFILE_TEST_ROOM_ID="${ROOM_ID}" \
PROFILE_SEED_OUTPUT_PATH="$SEED_OUTPUT_PATH" \
npx tsx tests/profiling/seed.ts

if [[ -f "$SEED_OUTPUT_PATH" ]]; then
  echo "Seed output captured at $SEED_OUTPUT_PATH"
  GUESS_ROOM_ID=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(data.rooms&&data.rooms.guessRoomId) process.stdout.write(String(data.rooms.guessRoomId));" "$SEED_OUTPUT_PATH")
  LEADERBOARD_ROOM_ID=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(data.rooms&&data.rooms.leaderboardRoomId) process.stdout.write(String(data.rooms.leaderboardRoomId));" "$SEED_OUTPUT_PATH")
  if [[ -n "$GUESS_ROOM_ID" ]]; then
    echo "Using seeded guess room ID $GUESS_ROOM_ID"
    ROOM_ID="$GUESS_ROOM_ID"
  fi
  if [[ -n "$LEADERBOARD_ROOM_ID" ]]; then
    export PROFILE_SEEDED_LEADERBOARD_ROOM_ID="$LEADERBOARD_ROOM_ID"
  fi
fi

if [[ -z "${PROFILE_TEST_CREDENTIAL:-}" || -z "${PROFILE_TEST_PASSWORD:-}" ]]; then
  echo "PROFILE_TEST_CREDENTIAL and PROFILE_TEST_PASSWORD must be defined (see tests/profiling/.env)" >&2
  exit 1
fi

echo "Fetching auth token for ${PROFILE_TEST_CREDENTIAL}..."
AUTH_TOKEN="$(
  PROFILE_TEST_CREDENTIAL="${PROFILE_TEST_CREDENTIAL}" \
  PROFILE_TEST_PASSWORD="${PROFILE_TEST_PASSWORD}" \
  PROFILE_BASE_URL="${PROFILE_BASE_URL}" \
  PROFILE_SIGNIN_PATH="${PROFILE_SIGNIN_PATH}" \
  PROFILE_OUTPUT="token" \
  node tests/profiling/login.mjs
)"

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

HTTP_GUESS_ENDPOINT="${HTTP_GUESS_ENDPOINT:-/api/rooms/${ROOM_ID}}"
HTTP_GUESS_BODY="$(build_guess_body)"

run_http_load() {
  local name=$1
  local url=$2
  local method=$3
  local body=$4
  local concurrency=$5
  local duration=$6
  local log_file="${run_dir}/${name}-http.json"

  echo "==> HTTP load (${name}): ${url}"
  HTTP_NAME="$name" \
  HTTP_TARGET="$url" \
  HTTP_METHOD="$method" \
  HTTP_BODY="$body" \
  HTTP_CONCURRENCY="$concurrency" \
  HTTP_DURATION_MS="$duration" \
  AUTH_TOKEN="$AUTH_TOKEN" \
  EXTRA_HEADERS='{}' \
  node tests/profiling/http-stress.mjs | tee "$log_file"
}

run_ws_load() {
  local log_file="${run_dir}/ws-${WS_EVENT}.json"
  echo "==> Websocket load (${WS_EVENT})"
  WS_URL="$PROFILE_SOCKET_URL" \
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
  AUTH_TOKEN="$AUTH_TOKEN" \
  node tests/profiling/ws-guess-load.mjs | tee "$log_file"
}

LEADERBOARD_ENDPOINT="${LEADERBOARD_ENDPOINT:-/api/leaderboard}"
HEAP_SNAPSHOT_ENDPOINT="${PROFILE_HTTP_ORIGIN}/internal/profiling/heap-snapshot"
CPU_PROFILE_START_ENDPOINT="${PROFILE_HTTP_ORIGIN}/internal/profiling/cpu-profile/start"
CPU_PROFILE_STOP_ENDPOINT="${PROFILE_HTTP_ORIGIN}/internal/profiling/cpu-profile/stop"
HEAP_PROFILE_START_ENDPOINT="${PROFILE_HTTP_ORIGIN}/internal/profiling/heap-profile/start"
HEAP_PROFILE_STOP_ENDPOINT="${PROFILE_HTTP_ORIGIN}/internal/profiling/heap-profile/stop"

echo "Starting CPU profiler..."
call_endpoint "$CPU_PROFILE_START_ENDPOINT"
echo "Starting heap profiler..."
call_endpoint "$HEAP_PROFILE_START_ENDPOINT"

run_http_load "guess" "${PROFILE_HTTP_ORIGIN}${HTTP_GUESS_ENDPOINT}" "POST" "$HTTP_GUESS_BODY" "$HTTP_CONCURRENCY" "$HTTP_DURATION_MS"
run_http_load "leaderboard" "${PROFILE_HTTP_ORIGIN}${LEADERBOARD_ENDPOINT}" "GET" "" "$LEADERBOARD_CONCURRENCY" "$LEADERBOARD_DURATION_MS"
run_ws_load

echo "Stopping heap profiler..."
call_endpoint "$HEAP_PROFILE_STOP_ENDPOINT"
wait_for_artifact "${PROFILE_RAW_DIR}/*.heapprofile" "Heap profile" 10 0.5
echo "Stopping CPU profiler..."
call_endpoint "$CPU_PROFILE_STOP_ENDPOINT"
wait_for_artifact "${PROFILE_RAW_DIR}/*.cpuprofile" "CPU profile" 10 0.5

echo "Requesting heap snapshot from API..."
call_endpoint "$HEAP_SNAPSHOT_ENDPOINT"
wait_for_artifact "${PROFILE_RAW_DIR}/*.heapsnapshot" "Heap snapshot" 10 0.5

profile_copy_dir="${run_dir}/profiles"
cpu_copy_dir="${profile_copy_dir}/cpu"
heap_copy_dir="${profile_copy_dir}/heap"
mkdir -p "$cpu_copy_dir" "$heap_copy_dir"

if compgen -G "${PROFILE_RAW_DIR}/*.cpuprofile" >/dev/null; then
  cp "${PROFILE_RAW_DIR}"/*.cpuprofile "$cpu_copy_dir"/
  echo "Copied CPU profiles to ${cpu_copy_dir}"
else
  echo "No CPU profiles were found in ${PROFILE_RAW_DIR}"
fi

if compgen -G "${PROFILE_RAW_DIR}/*.heapprofile" >/dev/null; then
  cp "${PROFILE_RAW_DIR}"/*.heapprofile "$heap_copy_dir"/
  echo "Copied heap profiles to ${heap_copy_dir}"
else
  echo "No heap profiles were found in ${PROFILE_RAW_DIR}"
fi

if compgen -G "${PROFILE_RAW_DIR}/*.heapsnapshot" >/dev/null; then
  cp "${PROFILE_RAW_DIR}"/*.heapsnapshot "$heap_copy_dir"/
  echo "Copied heap snapshots to ${heap_copy_dir}"
fi

echo "Profiling run complete. Results stored in ${run_dir}"
