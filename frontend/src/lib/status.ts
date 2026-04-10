import { ParamSpec } from "./config";

export type Status = "ok" | "warn" | "breach" | "stale";

export function statusFor(value: number | undefined, spec: ParamSpec, bufferPct: number): Status {
  if (value === undefined) return "stale";
  if (value < spec.min || value > spec.max) return "breach";
  const span = spec.max - spec.min;
  const buffer = (span * bufferPct) / 100;
  if (value < spec.min + buffer || value > spec.max - buffer) return "warn";
  return "ok";
}

export function statusColor(s: Status): string {
  switch (s) {
    case "ok": return "var(--ink)";
    case "warn": return "var(--warn)";
    case "breach": return "var(--breach)";
    case "stale": return "var(--stale)";
  }
}

// Simple linear regression slope on last N points
export function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function isDrifting(values: number[], spec: ParamSpec, projectM: number): boolean {
  if (values.length < 3) return false;
  const s = slope(values);
  const projected = values[values.length - 1] + s * projectM;
  return projected < spec.min || projected > spec.max;
}
