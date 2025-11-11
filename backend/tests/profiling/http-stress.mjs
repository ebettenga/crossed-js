#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const {
  HTTP_TARGET,
  HTTP_METHOD = 'GET',
  HTTP_BODY = '',
  HTTP_NAME = 'http-stress',
  HTTP_CONCURRENCY = '10',
  HTTP_DURATION_MS = '30000',
  AUTH_TOKEN = '',
  EXTRA_HEADERS = '{}',
  HTTP_EXPECTED_STATUS = '',
} = process.env;

if (!HTTP_TARGET) {
  console.error('HTTP_TARGET is required');
  process.exit(1);
}

let headersFromEnv;
try {
  headersFromEnv = JSON.parse(EXTRA_HEADERS || '{}');
} catch (error) {
  console.error('Failed to parse EXTRA_HEADERS JSON:', error);
  process.exit(1);
}

const normalizedHeaders = {};
for (const [key, value] of Object.entries(headersFromEnv)) {
  if (value !== undefined && value !== null) {
    normalizedHeaders[key] = String(value);
  }
}

const method = HTTP_METHOD.toUpperCase();
if (
  AUTH_TOKEN &&
  !normalizedHeaders.authorization &&
  !normalizedHeaders.Authorization
) {
  normalizedHeaders.Authorization = `Bearer ${AUTH_TOKEN}`;
}

if (
  method !== 'GET' &&
  HTTP_BODY &&
  !normalizedHeaders['Content-Type'] &&
  !normalizedHeaders['content-type']
) {
  normalizedHeaders['Content-Type'] = 'application/json';
}

const concurrency = Number.parseInt(HTTP_CONCURRENCY, 10);
const durationMs = Number.parseInt(HTTP_DURATION_MS, 10);
if (Number.isNaN(concurrency) || concurrency <= 0) {
  console.error('HTTP_CONCURRENCY must be a positive integer');
  process.exit(1);
}
if (Number.isNaN(durationMs) || durationMs <= 0) {
  console.error('HTTP_DURATION_MS must be a positive integer');
  process.exit(1);
}

const expectedStatus = HTTP_EXPECTED_STATUS.trim();
const MAX_FAILURE_SAMPLES = Number.parseInt(
  process.env.HTTP_FAILURE_SAMPLES ?? '5',
  10,
);

const stats = {
  name: HTTP_NAME,
  target: HTTP_TARGET,
  method,
  concurrency,
  durationMs,
  startedAt: new Date().toISOString(),
  totals: {
    sent: 0,
    succeeded: 0,
    failed: 0,
  },
  statuses: new Map(),
  latencies: [],
  failureSamples: [],
};

function recordStatus(status) {
  const current = stats.statuses.get(status) || 0;
  stats.statuses.set(status, current + 1);
}

async function worker() {
  const stopAt = Date.now() + durationMs;
  while (Date.now() < stopAt) {
    const start = performance.now();
    stats.totals.sent += 1;
    try {
      const response = await fetch(HTTP_TARGET, {
        method,
        headers: normalizedHeaders,
        body: HTTP_BODY ? HTTP_BODY : undefined,
      });

      const latency = performance.now() - start;
      stats.latencies.push(latency);
      recordStatus(response.status);
      const okByExpectation = expectedStatus
        ? String(response.status) === expectedStatus
        : response.ok;
      if (okByExpectation) {
        stats.totals.succeeded += 1;
        await response.arrayBuffer().catch(() => undefined);
      } else {
        stats.totals.failed += 1;
        if (
          stats.failureSamples.length < Math.max(0, MAX_FAILURE_SAMPLES || 0)
        ) {
          const bodyText = await response
            .text()
            .catch(() => '<body unreadable>');
          stats.failureSamples.push({
            status: response.status,
            okByExpectation,
            body: bodyText,
          });
        } else {
          await response.arrayBuffer().catch(() => undefined);
        }
      }
    } catch (error) {
      stats.totals.failed += 1;
      stats.latencies.push(performance.now() - start);
      if (stats.failureSamples.length < Math.max(0, MAX_FAILURE_SAMPLES || 0)) {
        stats.failureSamples.push({
          status: 'network_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

const latencies = stats.latencies.sort((a, b) => a - b);
function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }
  const idx = Math.min(
    values.length - 1,
    Math.max(0, Math.floor(ratio * values.length)),
  );
  return Number(values[idx].toFixed(2));
}

const latencySummary = {
  count: latencies.length,
  minMs: latencies.length ? Number(latencies[0].toFixed(2)) : 0,
  maxMs: latencies.length
    ? Number(latencies[latencies.length - 1].toFixed(2))
    : 0,
  avgMs: latencies.length
    ? Number(
        (
          latencies.reduce((acc, value) => acc + value, 0) / latencies.length
        ).toFixed(2),
      )
    : 0,
  p50Ms: percentile(latencies, 0.5),
  p90Ms: percentile(latencies, 0.9),
  p99Ms: percentile(latencies, 0.99),
};

const summary = {
  name: stats.name,
  target: stats.target,
  method: stats.method,
  startedAt: stats.startedAt,
  durationMs: stats.durationMs,
  concurrency: stats.concurrency,
  totals: stats.totals,
  statuses: Object.fromEntries(stats.statuses),
  latencyMs: latencySummary,
  failureSamples: stats.failureSamples,
};

console.log(`[HTTP] ${stats.name} completed`);
console.log(JSON.stringify(summary, null, 2));

if (stats.totals.succeeded === 0) {
  console.error(`[HTTP] ${stats.name} recorded zero successful requests`);
  process.exit(1);
}
