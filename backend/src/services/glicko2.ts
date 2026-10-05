// Glicko-2 (http://www.glicko.net/glicko/glicko2.pdf), with Lichess's
// continuous rating periods: deviation grows with elapsed time instead of
// fixed periods, so a game is rated as soon as it finishes.

const SCALE = 173.7178;
const CENTER = 1500;
const CONVERGENCE = 0.000001;

export interface Glicko2Rating {
  rating: number;
  deviation: number;
  volatility: number;
}

export interface Glicko2Result {
  opponent: Glicko2Rating;
  // 1 = win, 0.5 = draw, 0 = loss
  score: number;
}

export interface Glicko2Options {
  tau: number;
  minDeviation: number;
  maxDeviation: number;
  maxVolatility: number;
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

const expected = (mu: number, muJ: number, phiJ: number) =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function inflateDeviation(
  player: Glicko2Rating,
  elapsedPeriods: number,
  options: Pick<Glicko2Options, "minDeviation" | "maxDeviation">,
): number {
  const phi = player.deviation / SCALE;
  const inflated = Math.sqrt(
    phi * phi + Math.max(0, elapsedPeriods) * player.volatility ** 2,
  );
  return clamp(inflated * SCALE, options.minDeviation, options.maxDeviation);
}

function newVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number,
  tau: number,
): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) -
      (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > CONVERGENCE) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Rate one player against every result from a single game. The player's and
 * opponents' deviations should already be inflated for inactivity.
 */
export function rate(
  player: Glicko2Rating,
  results: Glicko2Result[],
  options: Glicko2Options,
): Glicko2Rating {
  if (results.length === 0) return { ...player };

  const mu = (player.rating - CENTER) / SCALE;
  const phi = player.deviation / SCALE;

  let vInverse = 0;
  let improvement = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - CENTER) / SCALE;
    const phiJ = opponent.deviation / SCALE;
    const gJ = g(phiJ);
    const e = expected(mu, muJ, phiJ);
    vInverse += gJ * gJ * e * (1 - e);
    improvement += gJ * (score - e);
  }
  const v = 1 / vInverse;
  const delta = v * improvement;

  const sigma = Math.min(
    options.maxVolatility,
    newVolatility(player.volatility, phi, v, delta, options.tau),
  );
  const newPhi = 1 / Math.sqrt(1 / (phi * phi) + 1 / v);
  const newMu = mu + newPhi * newPhi * improvement;

  return {
    rating: newMu * SCALE + CENTER,
    deviation: clamp(newPhi * SCALE, options.minDeviation, options.maxDeviation),
    volatility: sigma,
  };
}
