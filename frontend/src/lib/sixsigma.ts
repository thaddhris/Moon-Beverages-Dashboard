// Six Sigma / SPC primitives for QC analysis.

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Sample standard deviation (n-1).
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sq = values.reduce((acc, v) => acc + (v - m) * (v - m), 0);
  return Math.sqrt(sq / (values.length - 1));
}

export interface ControlLimits {
  mean: number;
  sigma: number;
  ucl: number; // μ + 3σ
  lcl: number; // μ − 3σ
}

export function controlLimits(values: number[]): ControlLimits {
  const m = mean(values);
  const s = stddev(values);
  return { mean: m, sigma: s, ucl: m + 3 * s, lcl: m - 3 * s };
}

export interface Capability {
  cp: number | null;
  cpk: number | null;
  rating: "Excellent" | "Adequate" | "Marginal" | "Inadequate" | "Insufficient Data";
}

export function capability(
  values: number[],
  lsl: number,
  usl: number
): Capability {
  if (values.length < 2) {
    return { cp: null, cpk: null, rating: "Insufficient Data" };
  }
  const m = mean(values);
  const s = stddev(values);
  if (s === 0) {
    // Zero spread — if centred within spec, treat as excellent
    const inSpec = m >= lsl && m <= usl;
    return { cp: null, cpk: null, rating: inSpec ? "Excellent" : "Inadequate" };
  }
  const cp = (usl - lsl) / (6 * s);
  const cpkUpper = (usl - m) / (3 * s);
  const cpkLower = (m - lsl) / (3 * s);
  const cpk = Math.min(cpkUpper, cpkLower);
  const rating =
    cpk >= 1.67 ? "Excellent" :
    cpk >= 1.33 ? "Adequate" :
    cpk >= 1.0  ? "Marginal" : "Inadequate";
  return { cp, cpk, rating };
}

export function ratingColor(
  rating: Capability["rating"]
): { fg: string; bg: string; border: string } {
  switch (rating) {
    case "Excellent":  return { fg: "#166534", bg: "#f3fbf6", border: "#22c55e" };
    case "Adequate":   return { fg: "#0369a1", bg: "#eff6ff", border: "#3b82f6" };
    case "Marginal":   return { fg: "#854d0e", bg: "#fefce8", border: "#f59e0b" };
    case "Inadequate": return { fg: "#991b1b", bg: "#fef2f2", border: "#ef4444" };
    default:           return { fg: "#475569", bg: "#f8fafc", border: "#cbd5e1" };
  }
}
