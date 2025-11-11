#!/usr/bin/env node
/**
 * Fetches an access token for the test account specified via env vars.
 *
 * Required env:
 *   PROFILE_TEST_CREDENTIAL (username or email)
 *   PROFILE_TEST_PASSWORD
 *
 * Optional env:
 *   PROFILE_BASE_URL (default http://localhost:3000/api)
 *   PROFILE_SIGNIN_PATH (default /signin)
 *   PROFILE_OUTPUT (token | json) default token
 *   PROFILE_REQUEST_TIMEOUT_MS (default 10000)
 */

const {
  PROFILE_TEST_CREDENTIAL,
  PROFILE_TEST_USERNAME,
  PROFILE_TEST_EMAIL,
  PROFILE_TEST_PASSWORD,
  PROFILE_BASE_URL = "http://localhost:3000/api",
  PROFILE_SIGNIN_PATH = "/signin",
  PROFILE_OUTPUT = "token",
  PROFILE_REQUEST_TIMEOUT_MS = "10000",
} = process.env;

const credential =
  PROFILE_TEST_CREDENTIAL ??
  PROFILE_TEST_USERNAME ??
  PROFILE_TEST_EMAIL;

if (!credential) {
  console.error(
    "PROFILE_TEST_CREDENTIAL (or PROFILE_TEST_USERNAME/PROFILE_TEST_EMAIL) is required",
  );
  process.exit(1);
}

if (!PROFILE_TEST_PASSWORD) {
  console.error("PROFILE_TEST_PASSWORD is required");
  process.exit(1);
}

const timeoutMs = Number.parseInt(PROFILE_REQUEST_TIMEOUT_MS, 10);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error("PROFILE_REQUEST_TIMEOUT_MS must be a positive integer");
  process.exit(1);
}

const baseUrl = PROFILE_BASE_URL.replace(/\/+$/, "");
const signinPath = PROFILE_SIGNIN_PATH.startsWith("/")
  ? PROFILE_SIGNIN_PATH
  : `/${PROFILE_SIGNIN_PATH}`;
const endpoint = `${baseUrl}${signinPath}`;

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

let response;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      password: PROFILE_TEST_PASSWORD,
    }),
    signal: controller.signal,
  });
} catch (error) {
  if (error.name === "AbortError") {
    console.error(
      `Login request timed out after ${timeoutMs}ms (${endpoint})`,
    );
  } else {
    console.error("Failed to reach signin endpoint:", error);
  }
  process.exit(1);
} finally {
  clearTimeout(timeoutId);
}

if (!response.ok) {
  const body = await response.text();
  console.error(
    `Signin failed with status ${response.status}: ${body || response.statusText}`,
  );
  process.exit(1);
}

let payload;
try {
  payload = await response.json();
} catch (error) {
  console.error("Failed to parse signin response JSON:", error);
  process.exit(1);
}

const accessToken =
  payload.access_token ??
  payload.accessToken ??
  payload.token ??
  null;

if (!accessToken) {
  console.error("Signin response did not include an access token");
  process.exit(1);
}

const result = {
  accessToken,
  refreshToken: payload.refresh_token ?? payload.refreshToken ?? null,
  userId: payload.user_id ?? payload.user?.id ?? null,
  username: payload.user?.username ?? credential,
};

const output = PROFILE_OUTPUT.toLowerCase();
if (output === "json") {
  console.log(JSON.stringify(result, null, 2));
} else {
  process.stdout.write(accessToken);
}
