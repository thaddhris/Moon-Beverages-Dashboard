import { DEFAULT_PARAMS, ParamKey, FREQUENCY_HOURS } from "./config";

export interface Reading {
  ts: number;
  values: Partial<Record<ParamKey, number>>;
  sensory: { appearance: string; odor: string; taste: string };
  shift: "A" | "B" | "C";
  operator: string;
  remarks?: string;      // D171
  qaExecutive?: string;  // D172
  teamLeader?: string;   // D173
}

// Deterministic PRNG — ensures SSR/CSR parity
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Current time — computed at module load. Real IOsense data is live, so we
// anchor all "last N days" filters to the actual wall clock.
export const NOW_TS = Date.now();
const DAY_MS = 24 * 3600 * 1000;
const SLOT_HOURS = [0, 4, 8, 12, 16, 20]; // UTC hours per day for 4h readings

const OPERATORS = ["R. Sharma", "P. Iyer", "M. Khan", "S. Das", "A. Verma", "K. Reddy"];

function shiftFor(ts: number): "A" | "B" | "C" {
  const h = new Date(ts).getUTCHours();
  if (h >= 6 && h < 14) return "A";
  if (h >= 14 && h < 22) return "B";
  return "C";
}

export function generateMockReadings(): Reading[] {
  const rand = mulberry32(42);
  const readings: Reading[] = [];
  const days = 90; // 3 months of history so "Previous 3 Months" etc. show data
  const startDay = Math.floor(NOW_TS / DAY_MS) - days;

  for (let d = 0; d < days; d++) {
    const dayStart = (startDay + d) * DAY_MS;
    const ageDays = days - d; // 30 = oldest, 0 = today

    // ── 4-hourly readings ──
    for (const h of SLOT_HOURS) {
      const ts = dayStart + h * 3600 * 1000;
      if (ts > NOW_TS) continue;

      const values: Partial<Record<ParamKey, number>> = {};
      const r = rand;

      // pH — diurnal + slow upward drift over 30d + acid event at d=18
      let pH = 7.2 + Math.sin((h / 24) * 2 * Math.PI) * 0.15 + (r() - 0.5) * 0.2;
      pH += (30 - ageDays) * 0.005; // slight drift
      if (ageDays >= 18 && ageDays <= 18.5) pH = 5.8 + r() * 0.2; // acid breach event
      values.pH = parseFloat(Math.max(0, pH).toFixed(2));

      // TDS — weekly sinusoidal pattern
      const tds = 250 + Math.sin((ageDays * Math.PI) / 3.5) * 80 + (r() - 0.5) * 40;
      values.tds = Math.round(Math.max(0, tds));

      // P Alkalinity — should be Nil; occasional false detections
      const pAlk = d % 9 === 0 && h === 8 ? 0.12 + r() * 0.05 : r() < 0.03 ? 0.06 + r() * 0.02 : 0;
      values.pAlkalinity = parseFloat(pAlk.toFixed(2));

      // M Alkalinity — within spec mostly, higher in mid-month
      const mAlk = 45 + Math.sin((ageDays * Math.PI) / 7) * 20 + (r() - 0.5) * 10;
      values.mAlkalinity = Math.round(Math.max(0, Math.min(120, mAlk)));

      // Turbidity — mostly clear, periodic spikes every ~7d at dawn
      let turb = 0.08 + r() * 0.07;
      if (ageDays % 7 === 3 && h === 4) turb = 0.35 + r() * 0.1; // weekly spike (breach)
      if (ageDays >= 10 && ageDays <= 10.5) turb = 0.45; // event breach
      values.turbidity = parseFloat(Math.max(0, turb).toFixed(2));

      // Free Chlorine — Nil spec; breach in last 6h of data, event at d=5
      let fCl = r() < 0.02 ? 0.03 + r() * 0.01 : 0;
      if (ageDays <= 0.25) fCl = 0.08 + r() * 0.04; // recent breach right now
      if (ageDays >= 5 && ageDays <= 5.25) fCl = 0.12; // historical event
      values.freeCl = parseFloat(Math.max(0, fCl).toFixed(2));

      // Total Chlorine — similar but slightly higher when freeCl is present
      values.totalCl = parseFloat(Math.max(0, values.freeCl! + (r() < 0.05 ? r() * 0.02 : 0)).toFixed(2));

      values[values.freeCl! > 0.05 ? "freeCl" : "freeCl"] = values.freeCl; // no-op lint

      readings.push({
        ts,
        values,
        sensory: {
          appearance: turb > 0.3 ? "Slightly hazy" : "Clear",
          odor: pAlk > 0.05 ? "Slight odor" : "Normal",
          taste: "Normal",
        },
        shift: shiftFor(ts),
        operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
      });
    }

    // ── Daily readings (taken at 08:00 UTC) ──
    const dailyTs = dayStart + 8 * 3600 * 1000;
    if (dailyTs <= NOW_TS) {
      const r = rand;
      const dailyValues: Partial<Record<ParamKey, number>> = {};

      // Total Hardness — target ~60, stays within 100
      const th = 55 + Math.cos((ageDays * Math.PI) / 5) * 20 + (r() - 0.5) * 10;
      dailyValues.totalHardness = Math.round(Math.max(0, th));

      // Ca Hardness — roughly 60% of total hardness
      dailyValues.caHardness = Math.round(Math.max(0, dailyValues.totalHardness! * 0.6 + (r() - 0.5) * 5));

      // Aluminium — mostly low; spike at d=15
      let al = 0.05 + r() * 0.06;
      if (ageDays >= 15 && ageDays <= 15.3) al = 0.28; // breach event
      dailyValues.aluminium = parseFloat(Math.max(0, al).toFixed(2));

      // Chloride — steady, slight seasonal wave
      const cl = 120 + Math.sin((ageDays * Math.PI) / 10) * 40 + (r() - 0.5) * 20;
      dailyValues.chloride = Math.round(Math.max(0, cl));

      // Iron — drift up over last 7 days, spike at d=8
      let iron = 0.03 + r() * 0.03;
      if (ageDays <= 7) iron = 0.05 + (7 - ageDays) * 0.008 + r() * 0.01; // rising trend now
      if (ageDays >= 8 && ageDays <= 8.3) iron = 0.18; // historical spike
      dailyValues.iron = parseFloat(Math.max(0, iron).toFixed(2));

      // Sulphate — moderate
      const sul = 100 + Math.cos((ageDays * Math.PI) / 8) * 40 + (r() - 0.5) * 20;
      dailyValues.sulphate = Math.round(Math.max(0, sul));

      // Sulphate+Chloride — computed (correlated to individual values with slight variance)
      dailyValues.sulphateChloride = Math.round(
        dailyValues.sulphate! + dailyValues.chloride! + (r() - 0.5) * 10
      );
      // Inject a combined breach at d=22
      if (ageDays >= 22 && ageDays <= 22.3) dailyValues.sulphateChloride = 420;

      readings.push({
        ts: dailyTs,
        values: dailyValues,
        sensory: { appearance: "Clear", odor: "Normal", taste: "Normal" },
        shift: shiftFor(dailyTs),
        operator: OPERATORS[Math.floor(rand() * OPERATORS.length)],
      });
    }
  }

  return readings;
}

export const MOCK_READINGS = generateMockReadings();

export function filterByRange(readings: Reading[], startTs: number, endTs: number): Reading[] {
  return readings.filter((r) => r.ts >= startTs && r.ts <= endTs);
}

export function latestPerParam(readings: Reading[]) {
  const latest: Partial<Record<ParamKey, { value: number; ts: number; operator: string; shift: string }>> = {};
  for (let i = readings.length - 1; i >= 0; i--) {
    const r = readings[i];
    for (const k of Object.keys(r.values) as ParamKey[]) {
      if (latest[k] === undefined && r.values[k] !== undefined) {
        latest[k] = { value: r.values[k]!, ts: r.ts, operator: r.operator, shift: r.shift };
      }
    }
  }
  return latest;
}

export function seriesFor(
  readings: Reading[],
  key: ParamKey
): { ts: number; v: number; operator: string; shift: string }[] {
  const out: { ts: number; v: number; operator: string; shift: string }[] = [];
  for (const r of readings) {
    if (r.values[key] !== undefined) {
      out.push({ ts: r.ts, v: r.values[key]!, operator: r.operator, shift: r.shift });
    }
  }
  return out;
}
