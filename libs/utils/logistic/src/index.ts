// L2-penalised logistic regression fitted by Newton's method, for a handful
// of features. Knows nothing about microbiology. The first weight is the
// intercept and is not penalised; rows of `x` hold the other features.

export interface LogisticModel {
  /** Intercept first, then one weight per feature. */
  weights: number[];
  iterations: number;
  converged: boolean;
}

export interface FitOptions {
  /** Penalty on the squared feature weights (not the intercept). Default 1. */
  l2?: number;
  maxIterations?: number;
  tolerance?: number;
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

export function predict(model: LogisticModel, x: readonly number[]): number {
  let z = model.weights[0] as number;
  for (let j = 0; j < x.length; j++) z += (model.weights[j + 1] as number) * (x[j] as number);
  return sigmoid(z);
}

/** Solves A v = b for a small symmetric positive definite A (Gaussian elimination with pivoting). */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] as number]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs((m[r] as number[])[c] as number) > Math.abs((m[pivot] as number[])[c] as number)) pivot = r;
    [m[c], m[pivot]] = [m[pivot] as number[], m[c] as number[]];
    const row = m[c] as number[];
    const d = row[c] as number;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const other = m[r] as number[];
      const f = (other[c] as number) / d;
      if (f !== 0) for (let k = c; k <= n; k++) other[k] = (other[k] as number) - f * (row[k] as number);
    }
  }
  return m.map((row, i) => (row[n] as number) / (row[i] as number));
}

export function fitLogistic(x: readonly (readonly number[])[], y: readonly (0 | 1)[], options: FitOptions = {}): LogisticModel {
  const l2 = options.l2 ?? 1;
  const maxIterations = options.maxIterations ?? 50;
  const tolerance = options.tolerance ?? 1e-8;
  const d = (x[0]?.length ?? 0) + 1;
  // Start the intercept at the observed log odds.
  const mean = y.length ? (y.reduce<number>((s, v) => s + v, 0) + 0.5) / (y.length + 1) : 0.5;
  const weights = [Math.log(mean / (1 - mean)), ...new Array<number>(d - 1).fill(0)];
  for (let it = 1; it <= maxIterations; it++) {
    const grad = new Array<number>(d).fill(0);
    const hess = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    for (let i = 0; i < y.length; i++) {
      const row = [1, ...(x[i] as number[])];
      let z = 0;
      for (let j = 0; j < d; j++) z += (weights[j] as number) * (row[j] as number);
      const p = sigmoid(z);
      const w = p * (1 - p);
      const r = p - (y[i] as number);
      for (let j = 0; j < d; j++) {
        grad[j] = (grad[j] as number) + r * (row[j] as number);
        const hj = hess[j] as number[];
        for (let k = 0; k <= j; k++) hj[k] = (hj[k] as number) + w * (row[j] as number) * (row[k] as number);
      }
    }
    for (let j = 0; j < d; j++) {
      const hj = hess[j] as number[];
      for (let k = 0; k < j; k++) (hess[k] as number[])[j] = hj[k] as number;
      if (j > 0) {
        grad[j] = (grad[j] as number) + l2 * (weights[j] as number);
        hj[j] = (hj[j] as number) + l2;
      }
    }
    (hess[0] as number[])[0] = ((hess[0] as number[])[0] as number) + 1e-9;
    const step = solve(hess, grad);
    let biggest = 0;
    for (let j = 0; j < d; j++) {
      weights[j] = (weights[j] as number) - (step[j] as number);
      biggest = Math.max(biggest, Math.abs(step[j] as number));
    }
    if (biggest < tolerance) return { weights, iterations: it, converged: true };
  }
  return { weights, iterations: maxIterations, converged: false };
}
