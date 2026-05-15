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

// ─── Raw Water mock readings ──────────────────────────────────────────────────
// One reading per day at 08:00 UTC for all source-suffixed params.
// Per-source offsets introduce realistic variation between borewell sources.
export function generateRawWaterReadings(): Reading[] {
  const rand = mulberry32(99);
  const readings: Reading[] = [];
  const days = 90;
  const startDay = Math.floor(NOW_TS / DAY_MS) - days;

  const sources = ["st", "bw1", "bw2", "bw3"] as const;
  // per-source base offsets so each looks distinct
  const srcOffset: Record<string, { pH: number; tds: number; th: number; turb: number }> = {
    st:  { pH: 0,     tds: 0,   th: 0,   turb: 0    },
    bw1: { pH: 0.15,  tds: 80,  th: 40,  turb: 0.5  },
    bw2: { pH: -0.1,  tds: 120, th: 60,  turb: 0.8  },
    bw3: { pH: 0.08,  tds: 200, th: 80,  turb: 0.3  },
  };

  for (let d = 0; d < days; d++) {
    const dayStart = (startDay + d) * DAY_MS;
    const ageDays = days - d;
    const ts = dayStart + 8 * 3600 * 1000;
    if (ts > NOW_TS) continue;

    const values: Partial<Record<ParamKey, number>> = {};
    const r = rand;

    for (const src of sources) {
      const off = srcOffset[src];

      // pH
      const pH = 7.1 + off.pH + Math.sin((ageDays * Math.PI) / 12) * 0.2 + (r() - 0.5) * 0.15;
      (values as any)[`pH_${src}`] = parseFloat(Math.max(0, pH).toFixed(2));

      // TDS — borewell sources higher than storage tank
      const tds = 380 + off.tds + Math.cos((ageDays * Math.PI) / 7) * 60 + (r() - 0.5) * 30;
      (values as any)[`tds_${src}`] = Math.round(Math.max(0, tds));

      // Total Hardness
      const th = 180 + off.th + Math.sin((ageDays * Math.PI) / 9) * 30 + (r() - 0.5) * 15;
      const thVal = Math.round(Math.max(0, th));
      (values as any)[`totalHardness_${src}`] = thVal;

      // Ca Hardness — ~55% of total
      (values as any)[`caHardness_${src}`] = Math.round(Math.max(0, thVal * 0.55 + (r() - 0.5) * 8));

      // P Alkalinity — should be Nil
      const pAlk = r() < 0.04 ? 0.03 + r() * 0.02 : 0;
      (values as any)[`pAlkalinity_${src}`] = parseFloat(pAlk.toFixed(2));

      // M Alkalinity
      const mAlk = 200 + Math.sin((ageDays * Math.PI) / 6) * 50 + (r() - 0.5) * 20;
      (values as any)[`mAlkalinity_${src}`] = Math.round(Math.max(0, mAlk));

      // Turbidity
      let turb = 0.5 + off.turb + r() * 0.8;
      if (ageDays % 7 === 2) turb += 3 + r() * 2; // weekly spike
      (values as any)[`turbidity_${src}`] = parseFloat(Math.max(0, turb).toFixed(1));

      // Weekly params — iron, chloride, sulphate (included every day in mock so there's always data)
      const iron = 0.08 + r() * 0.12;
      (values as any)[`iron_${src}`] = parseFloat(Math.max(0, iron).toFixed(2));

      const chloride = 80 + off.tds * 0.3 + Math.sin((ageDays * Math.PI) / 8) * 30 + (r() - 0.5) * 15;
      (values as any)[`chloride_${src}`] = Math.round(Math.max(0, chloride));

      const sulphate = 90 + off.tds * 0.2 + Math.cos((ageDays * Math.PI) / 10) * 35 + (r() - 0.5) * 15;
      (values as any)[`sulphate_${src}`] = Math.round(Math.max(0, sulphate));
    }

    // CWT and FWT residual stages (daily) — same reading as main daily
    const cwtOff = { pH: 0.2, tds: -80, th: -40, turb: -0.2 };
    const fwtOff = { pH: 0.1, tds: -60, th: -30, turb: -0.15 };

    for (const [sfx, off] of [["cwt", cwtOff], ["fwt", fwtOff]] as const) {
      const pHv = 7.0 + off.pH + Math.sin((ageDays * Math.PI) / 14) * 0.15 + (r() - 0.5) * 0.1;
      (values as any)[`pH_${sfx}`]            = parseFloat(Math.max(0, pHv).toFixed(2));
      const tdsv = 300 + off.tds + Math.cos((ageDays * Math.PI) / 7) * 40 + (r() - 0.5) * 20;
      (values as any)[`tds_${sfx}`]           = Math.round(Math.max(0, tdsv));
      const thv = 140 + off.th + Math.sin((ageDays * Math.PI) / 9) * 25 + (r() - 0.5) * 12;
      const thVal = Math.round(Math.max(0, thv));
      (values as any)[`totalHardness_${sfx}`] = thVal;
      (values as any)[`caHardness_${sfx}`]    = Math.round(Math.max(0, thVal * 0.55 + (r() - 0.5) * 6));
      (values as any)[`pAlkalinity_${sfx}`]   = parseFloat((r() < 0.04 ? 0.02 + r() * 0.02 : 0).toFixed(2));
      (values as any)[`mAlkalinity_${sfx}`]   = Math.round(Math.max(0, 160 + Math.sin((ageDays * Math.PI) / 6) * 40 + (r() - 0.5) * 15));
      let turbv = 0.3 + off.turb + r() * 0.5;
      if (ageDays % 7 === 2) turbv += 2 + r();
      (values as any)[`turbidity_${sfx}`]     = parseFloat(Math.max(0, turbv).toFixed(1));
      (values as any)[`residualCl_${sfx}`]    = parseFloat((2.5 + (r() - 0.5) * 0.8).toFixed(2));
      (values as any)[`iron_${sfx}`]          = parseFloat(Math.max(0, 0.07 + r() * 0.1).toFixed(2));
      (values as any)[`chloride_${sfx}`]      = Math.round(Math.max(0, 70 + (r() - 0.5) * 25));
      (values as any)[`sulphate_${sfx}`]      = Math.round(Math.max(0, 80 + (r() - 0.5) * 25));
    }

    readings.push({
      ts,
      values,
      sensory: { appearance: "Clear", odor: "Normal", taste: "Normal" },
      shift: shiftFor(ts),
      operator: OPERATORS[Math.floor(rand() * OPERATORS.length)],
      qaExecutive: "V. Nair",
      teamLeader: "S. Mehta",
    });

    // RWT Residual Cl₂ stage — 12h: first reading at 08:00 (already in ts above)
    const rwtValues: Partial<Record<ParamKey, number>> = {};
    const pHv = 7.1 + Math.sin((ageDays * Math.PI) / 12) * 0.18 + (rand() - 0.5) * 0.12;
    rwtValues.pH_rwt            = parseFloat(Math.max(0, pHv).toFixed(2));
    const tdsv = 360 + Math.cos((ageDays * Math.PI) / 7) * 50 + (rand() - 0.5) * 25;
    rwtValues.tds_rwt           = Math.round(Math.max(0, tdsv));
    const thv = 170 + Math.sin((ageDays * Math.PI) / 9) * 28 + (rand() - 0.5) * 12;
    const thVal = Math.round(Math.max(0, thv));
    rwtValues.totalHardness_rwt = thVal;
    rwtValues.caHardness_rwt    = Math.round(Math.max(0, thVal * 0.55 + (rand() - 0.5) * 7));
    rwtValues.pAlkalinity_rwt   = parseFloat((rand() < 0.04 ? 0.02 + rand() * 0.02 : 0).toFixed(2));
    rwtValues.mAlkalinity_rwt   = Math.round(Math.max(0, 190 + Math.sin((ageDays * Math.PI) / 6) * 45 + (rand() - 0.5) * 18));
    let turbv = 0.4 + rand() * 0.7;
    if (ageDays % 7 === 2) turbv += 2.5 + rand();
    rwtValues.turbidity_rwt     = parseFloat(Math.max(0, turbv).toFixed(1));
    rwtValues.residualCl_rwt    = parseFloat((3.5 + (rand() - 0.5) * 0.6).toFixed(2));
    rwtValues.iron_rwt          = parseFloat(Math.max(0, 0.08 + rand() * 0.1).toFixed(2));
    rwtValues.chloride_rwt      = Math.round(Math.max(0, 75 + (rand() - 0.5) * 25));
    rwtValues.sulphate_rwt      = Math.round(Math.max(0, 85 + (rand() - 0.5) * 25));

    readings.push({
      ts,
      values: rwtValues,
      sensory: { appearance: "Clear", odor: "Normal", taste: "Normal" },
      shift: shiftFor(ts),
      operator: OPERATORS[Math.floor(rand() * OPERATORS.length)],
    });

    // RWT second 12h reading at 20:00 UTC
    const ts20 = dayStart + 20 * 3600 * 1000;
    if (ts20 <= NOW_TS) {
      const rv2: Partial<Record<ParamKey, number>> = {};
      rv2.pH_rwt            = parseFloat(Math.max(0, 7.1 + (rand() - 0.5) * 0.15).toFixed(2));
      rv2.tds_rwt           = Math.round(Math.max(0, 360 + (rand() - 0.5) * 30));
      const th2 = Math.round(Math.max(0, 170 + (rand() - 0.5) * 15));
      rv2.totalHardness_rwt = th2;
      rv2.caHardness_rwt    = Math.round(Math.max(0, th2 * 0.55 + (rand() - 0.5) * 5));
      rv2.pAlkalinity_rwt   = 0;
      rv2.mAlkalinity_rwt   = Math.round(Math.max(0, 190 + (rand() - 0.5) * 20));
      rv2.turbidity_rwt     = parseFloat(Math.max(0, 0.4 + rand() * 0.5).toFixed(1));
      rv2.residualCl_rwt    = parseFloat((3.5 + (rand() - 0.5) * 0.6).toFixed(2));
      readings.push({
        ts: ts20,
        values: rv2,
        sensory: { appearance: "Clear", odor: "Normal", taste: "Normal" },
        shift: shiftFor(ts20),
        operator: OPERATORS[Math.floor(rand() * OPERATORS.length)],
      });
    }
  }
  return readings;
}

// ─── Soft Water mock readings ─────────────────────────────────────────────────
// 4-hourly readings for NC / CH suffixed params; daily for chloride_* and iron_*.
export function generateSoftWaterReadings(): Reading[] {
  const rand = mulberry32(77);
  const readings: Reading[] = [];
  const days = 90;
  const startDay = Math.floor(NOW_TS / DAY_MS) - days;

  for (let d = 0; d < days; d++) {
    const dayStart = (startDay + d) * DAY_MS;
    const ageDays = days - d;

    // ── 4-hourly ──
    for (const h of SLOT_HOURS) {
      const ts = dayStart + h * 3600 * 1000;
      if (ts > NOW_TS) continue;
      const values: Partial<Record<ParamKey, number>> = {};
      const r = rand;

      for (const sfx of ["nc", "ch"] as const) {
        const chOffset = sfx === "ch" ? 0.1 : 0; // Chlorinated slightly higher pH
        const pH = 7.3 + chOffset + Math.sin((h / 24) * 2 * Math.PI) * 0.1 + (r() - 0.5) * 0.12;
        (values as any)[`pH_${sfx}`] = parseFloat(Math.max(0, pH).toFixed(2));

        const tds = 160 + Math.sin((ageDays * Math.PI) / 5) * 30 + (r() - 0.5) * 20;
        (values as any)[`tds_${sfx}`] = Math.round(Math.max(0, tds));

        const th = 40 + Math.cos((ageDays * Math.PI) / 7) * 10 + (r() - 0.5) * 5;
        const thVal = Math.round(Math.max(0, th));
        (values as any)[`totalHardness_${sfx}`] = thVal;
        (values as any)[`caHardness_${sfx}`] = Math.round(Math.max(0, thVal * 0.6 + (r() - 0.5) * 4));

        const mAlk = 80 + Math.sin((ageDays * Math.PI) / 8) * 20 + (r() - 0.5) * 10;
        (values as any)[`mAlkalinity_${sfx}`] = Math.round(Math.max(0, mAlk));

        let turb = 0.1 + r() * 0.2;
        if (ageDays % 7 === 1 && h === 0) turb = 0.9 + r() * 0.2;
        (values as any)[`turbidity_${sfx}`] = parseFloat(Math.max(0, turb).toFixed(2));

        const resCl = sfx === "ch" ? 0.15 + r() * 0.2 : 0.02 + r() * 0.05;
        (values as any)[`residualCl_${sfx}`] = parseFloat(Math.max(0, resCl).toFixed(2));
      }

      readings.push({
        ts,
        values,
        sensory: { appearance: "Clear", odor: "Normal", taste: "Normal" },
        shift: shiftFor(ts),
        operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
      });
    }

    // ── Daily ──
    const dailyTs = dayStart + 8 * 3600 * 1000;
    if (dailyTs <= NOW_TS) {
      const values: Partial<Record<ParamKey, number>> = {};
      const r = rand;
      for (const sfx of ["nc", "ch"] as const) {
        (values as any)[`chloride_${sfx}`] = Math.round(Math.max(0, 80 + (r() - 0.5) * 30));
        (values as any)[`iron_${sfx}`] = parseFloat(Math.max(0, 0.03 + r() * 0.05).toFixed(2));
      }
      readings.push({
        ts: dailyTs,
        values,
        sensory: { appearance: "Clear", odor: "Normal", taste: "Normal" },
        shift: shiftFor(dailyTs),
        operator: OPERATORS[Math.floor(rand() * OPERATORS.length)],
      });
    }
  }
  return readings;
}

export const MOCK_READINGS = generateMockReadings();
export const RAW_WATER_READINGS  = generateRawWaterReadings();
export const SOFT_WATER_READINGS = generateSoftWaterReadings();

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
