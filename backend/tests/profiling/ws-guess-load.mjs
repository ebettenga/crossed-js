#!/usr/bin/env node
import { io } from 'socket.io-client';

const {
  WS_URL = 'ws://localhost:3000',
  WS_PATH = '/socket.io',
  WS_CLIENTS = '10',
  WS_GUESSES_PER_CLIENT = '10',
  WS_GUESS_INTERVAL_MS = '200',
  WS_CLIENT_TIMEOUT_MS = '60000',
  ROOM_ID = '62',
  GUESS_X = '0',
  GUESS_Y = '1',
  GUESS_CHAR = 'd',
  AUTH_TOKEN = '',
  WS_EVENT = 'guess',
} = process.env;

if (!AUTH_TOKEN) {
  console.error('AUTH_TOKEN is required for websocket load generation');
  process.exit(1);
}

const clientCount = Number.parseInt(WS_CLIENTS, 10);
const guessesPerClient = Number.parseInt(WS_GUESSES_PER_CLIENT, 10);
const guessIntervalMs = Number.parseInt(WS_GUESS_INTERVAL_MS, 10);
const clientTimeoutMs = Number.parseInt(WS_CLIENT_TIMEOUT_MS, 10);

if (
  [clientCount, guessesPerClient, guessIntervalMs, clientTimeoutMs].some(
    (value) => Number.isNaN(value) || value <= 0,
  )
) {
  console.error(
    'Invalid websocket configuration - ensure numeric env vars are positive integers',
  );
  process.exit(1);
}

const payload = {
  roomId: Number.parseInt(ROOM_ID, 10),
  x: Number.parseInt(GUESS_X, 10),
  y: Number.parseInt(GUESS_Y, 10),
  guess: GUESS_CHAR,
};

const stats = {
  clientsRequested: clientCount,
  clientsConnected: 0,
  clientsCompleted: 0,
  clientsErrored: 0,
  guessesSent: 0,
};

function spawnClient(id) {
  return new Promise((resolve) => {
    const socket = io(WS_URL, {
      path: WS_PATH,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { authToken: AUTH_TOKEN },
    });

    let guesses = 0;
    let intervalId;
    let timeoutId;
    let finished = false;

    const closeClient = (status) => {
      if (finished) {
        return;
      }
      finished = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (socket.connected) {
        socket.disconnect();
      }
      if (status === 'error') {
        stats.clientsErrored += 1;
      } else {
        stats.clientsCompleted += 1;
      }
      resolve();
    };

    socket.on('connect', () => {
      stats.clientsConnected += 1;
      intervalId = setInterval(() => {
        socket.emit(WS_EVENT, payload);
        guesses += 1;
        stats.guessesSent += 1;
        if (guesses >= guessesPerClient) {
          closeClient('done');
        }
      }, guessIntervalMs);
    });

    socket.on('connect_error', (err) => {
      console.error(
        `[WS] Client ${id} failed to connect:`,
        err?.message ?? err,
      );
      closeClient('error');
    });

    socket.on('error', (err) => {
      console.error(`[WS] Client ${id} error:`, err?.message ?? err);
      closeClient('error');
    });

    timeoutId = setTimeout(() => {
      console.warn(`[WS] Client ${id} timed out after ${clientTimeoutMs}ms`);
      closeClient('error');
    }, clientTimeoutMs);
  });
}

await Promise.all(
  Array.from({ length: clientCount }, (_, index) => spawnClient(index + 1)),
);

console.log('[WS] Guess load complete');
console.log(JSON.stringify(stats, null, 2));

if (stats.clientsCompleted === 0) {
  console.error('[WS] No websocket clients completed successfully');
  process.exit(1);
}
