#!/usr/bin/env bash
# Builds a production-config release APK and publishes it as Crossed.apk on a
# single GitHub release, replacing the previous upload.
set -euo pipefail

RELEASE_TAG="android-latest"
ASSET_NAME="Crossed.apk"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/frontend/android"
OUT_DIR="$ROOT/frontend/build"
APK="$OUT_DIR/$ASSET_NAME"
LOG="$OUT_DIR/android-build.log"

mkdir -p "$OUT_DIR"

echo "Building $ASSET_NAME (log: $LOG)..."
# Backend test env vars leak into the Gradle JS bundling step and break it
(
  cd "$ANDROID_DIR"
  env -u POSTGRES_DB -u ROOM_SERVICE_TEST_DB_PORT -u TEST_REDIS_URL \
    NODE_ENV=production \
    ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
) >"$LOG" 2>&1 || {
  echo "Android build failed. Last lines of $LOG:" >&2
  tail -n 30 "$LOG" >&2
  exit 1
}

cp "$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk" "$APK"

COMMIT="$(git -C "$ROOT" rev-parse --short HEAD)"
NOTES="Latest sideload build from commit $COMMIT ($(date '+%Y-%m-%d %H:%M')). Installs over the previous build."

if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  gh release upload "$RELEASE_TAG" "$APK" --clobber
  gh release edit "$RELEASE_TAG" --notes "$NOTES" >/dev/null
else
  gh release create "$RELEASE_TAG" "$APK" \
    --title "Crossed Android (latest)" \
    --notes "$NOTES" \
    --prerelease \
    --target main
fi

echo "Published $(gh release view "$RELEASE_TAG" --json url --jq .url)"
