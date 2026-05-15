/**
 * IOsense data service for TREATED_WATER_COLA — a CUSTOM_TABLE03 device.
 * Data is stored as table rows (MongoDB), NOT InfluxDB time-series.
 * API: PUT /api/account/table/getRows3
 */

import { apiFetch } from "./api";
import { ParamKey } from "../config";
import { Reading } from "../mockData";

export const DEVICE_ID = "TREATED_WATER_COLA";

// ---------------------------------------------------------------------------
// Per-device sensor → ParamKey maps. Each device is a CUSTOM_TABLE03 with its
// own column layout. D0 is always the row timestamp.
//
// To onboard a new device, watch the "[IOsense] Device sensors:" console log
// after switching to that water type — the API returns sensor names which
// tell you which D column carries which parameter.
// ---------------------------------------------------------------------------

interface DeviceLayout {
  /** sensor column id → ParamKey numeric value */
  values: Record<string, ParamKey>;
  /** optional sensory text columns */
  sensory?: { appearance?: string; odor?: string; taste?: string };
  /** optional metadata columns */
  meta?: { remarks?: string; qaExecutive?: string; teamLeader?: string };
}

const DEVICE_LAYOUTS: Record<string, DeviceLayout> = {
  TREATED_WATER_COLA: {
    values: {
      D4:  "pH",
      D5:  "tds",
      D6:  "totalHardness",
      D7:  "caHardness",
      D8:  "pAlkalinity",
      D9:  "mAlkalinity",
      D10: "turbidity",
      D11: "aluminium",
      D12: "chloride",
      D13: "iron",
      D14: "sulphate",
      D15: "sulphateChloride",
      D16: "freeCl",
      D17: "totalCl",
    },
    sensory: { appearance: "D1", odor: "D2", taste: "D3" },
    meta:    { remarks: "D171", qaExecutive: "D172", teamLeader: "D173" },
  },
  // Raw Water — 7 sources × 10 numeric cols. Source order matches the form:
  //   ① Raw Water Storage Tank
  //   ② Borewell No. 1
  //   ③ Borewell No. 2
  //   ④ Borewell No. 3
  //   ⑤ Raw Water Storage Tank · Residual Cl₂   ← only source with appearance+odor
  //   ⑥ Clear Water Storage Tank · Residual Cl₂
  //   ⑦ Filter Water Storage Tank · Residual Cl₂
  // Column order within each source: TH, CaH, Iron, MAlk, Turb, pH, Chloride,
  // TDS, Sulphate, ResCl (ResCl only mapped on residual sources). D39 is
  // skipped in the device schema. Per-source text columns in the data file
  // outside of RWT Residual are ignored.
  RAW_WATER_COLA: {
    values: {
      // ① Raw Water Storage Tank — D2-D5, D7-D12 (D6 unused per device schema)
      D2:  "totalHardness_st",  D3:  "caHardness_st",  D4:  "iron_st",      D5:  "mAlkalinity_st",
      D7:  "turbidity_st",      D8:  "pH_st",          D9:  "chloride_st",  D10: "tds_st",
      D11: "sulphate_st",       // D12 — no residualCl_st in schema
      // ② Borewell No. 1 — D15-D24
      D15: "totalHardness_bw1", D16: "caHardness_bw1", D17: "iron_bw1",     D18: "mAlkalinity_bw1",
      D19: "turbidity_bw1",     D20: "pH_bw1",         D21: "chloride_bw1", D22: "tds_bw1",
      D23: "sulphate_bw1",      // D24
      // ③ Borewell No. 2 — D27-D36
      D27: "totalHardness_bw2", D28: "caHardness_bw2", D29: "iron_bw2",     D30: "mAlkalinity_bw2",
      D31: "turbidity_bw2",     D32: "pH_bw2",         D33: "chloride_bw2", D34: "tds_bw2",
      D35: "sulphate_bw2",      // D36
      // ④ Borewell No. 3 — D40-D49 (D39 skipped)
      D40: "totalHardness_bw3", D41: "caHardness_bw3", D42: "iron_bw3",     D43: "mAlkalinity_bw3",
      D44: "turbidity_bw3",     D45: "pH_bw3",         D46: "chloride_bw3", D47: "tds_bw3",
      D48: "sulphate_bw3",      // D49
      // ⑤ Raw Water Storage Tank · Residual Cl₂ — D52-D61 (D50=app, D51=odor)
      D52: "totalHardness_rwt", D53: "caHardness_rwt", D54: "iron_rwt",     D55: "mAlkalinity_rwt",
      D56: "turbidity_rwt",     D57: "pH_rwt",         D58: "chloride_rwt", D59: "tds_rwt",
      D60: "sulphate_rwt",      D61: "residualCl_rwt",
      // ⑥ Clear Water Storage Tank · Residual Cl₂ — D64-D73
      D64: "totalHardness_cwt", D65: "caHardness_cwt", D66: "iron_cwt",     D67: "mAlkalinity_cwt",
      D68: "turbidity_cwt",     D69: "pH_cwt",         D70: "chloride_cwt", D71: "tds_cwt",
      D72: "sulphate_cwt",      D73: "residualCl_cwt",
      // ⑦ Filter Water Storage Tank · Residual Cl₂ — D76-D85
      D76: "totalHardness_fwt", D77: "caHardness_fwt", D78: "iron_fwt",     D79: "mAlkalinity_fwt",
      D80: "turbidity_fwt",     D81: "pH_fwt",         D82: "chloride_fwt", D83: "tds_fwt",
      D84: "sulphate_fwt",      D85: "residualCl_fwt",
    },
    sensory: { appearance: "D50", odor: "D51" },
    meta:    { remarks: "D86", qaExecutive: "D87", teamLeader: "D88" },
  },

  // Soft Water — single sensory block at start, then NC line (9 cols), then
  // CH line (9 cols). Column order per line: TDS, pH, TH, CaH, MAlk, Turb,
  // ResCl, Chloride, Iron.
  SOFT_WATER_COLA: {
    values: {
      // Non-Chlorinated line
      D4:  "tds_nc",  D5:  "pH_nc",  D6:  "totalHardness_nc", D7:  "caHardness_nc",
      D8:  "mAlkalinity_nc", D9: "turbidity_nc", D10: "residualCl_nc",
      D11: "chloride_nc", D12: "iron_nc",
      // Chlorinated line
      D13: "tds_ch",  D14: "pH_ch",  D15: "totalHardness_ch", D16: "caHardness_ch",
      D17: "mAlkalinity_ch", D18: "turbidity_ch", D19: "residualCl_ch",
      D20: "chloride_ch", D21: "iron_ch",
    },
    sensory: { appearance: "D1", odor: "D2", taste: "D3" },
    meta:    { remarks: "D22", qaExecutive: "D23", teamLeader: "D24" },
  },
};

// Back-compat — older imports of SENSOR_TO_PARAM still resolve.
export const SENSOR_TO_PARAM: Record<string, ParamKey> = DEVICE_LAYOUTS.TREATED_WATER_COLA.values;

// For compatibility with page.tsx SensorMap type
export type SensorMap = Record<string, ParamKey>;

export function autoMapSensors(_sensors: any[], deviceId: string = DEVICE_ID): SensorMap {
  return { ...(DEVICE_LAYOUTS[deviceId]?.values ?? {}) };
}

export interface DeviceMeta {
  devID: string;
  devName: string;
  sensors: { sensorId: string; sensorName: string }[];
  unitSelected: Record<string, string>;
}

export async function fetchDeviceMeta(devID: string): Promise<DeviceMeta> {
  const res = await apiFetch<{ success: boolean; data: DeviceMeta }>(
    `/account/ai-sdk/metaData/device/${devID}`
  );
  if (!res.success) throw new Error(`Could not fetch metadata for ${devID}`);
  console.log("[IOsense] Device sensors:", res.data.sensors.slice(0, 20));
  return res.data;
}

// ---------------------------------------------------------------------------
// Parse DD/MM/YYYY HH:MM:SS  OR  ISO string  →  epoch ms
// ---------------------------------------------------------------------------

// Robust timestamp parser. The IOsense CT03 table can store timestamps in
// several formats — be lenient. Plant is in India so naive (timezone-less)
// strings are interpreted as IST (UTC+05:30). Strings already carrying a
// timezone designator (Z or ±HH:MM) are honoured as-is.
export function parseTime(t: string | number): number {
  if (typeof t === "number") return t;
  if (!t) return NaN;
  const s = String(t).trim();
  if (!s) return NaN;

  // ISO 8601 with explicit timezone — let Date handle it
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = new Date(s).getTime();
    if (!isNaN(ms)) return ms;
  }

  // YYYY-MM-DD[ T]HH:MM(:SS)?(.fff)?  — naive, treat as IST
  const ymd = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(s);
  if (ymd) {
    const [, y, m, d, h, mi, se] = ymd;
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${se ?? "00"}+05:30`).getTime();
  }

  // DD/MM/YYYY HH:MM(:SS)?  — naive, treat as IST
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (dmy) {
    const [, d, m, y, h, mi, se] = dmy;
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${se ?? "00"}+05:30`).getTime();
  }

  // YYYY-MM-DD only — IST midnight
  const ymdOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymdOnly) {
    const [, y, m, d] = ymdOnly;
    return new Date(`${y}-${m}-${d}T00:00:00+05:30`).getTime();
  }

  // Last resort — let Date try
  return new Date(s).getTime();
}

import { istHours } from "../ist";

function shiftFor(ts: number): "A" | "B" | "C" {
  const h = istHours(ts);
  if (h >= 6 && h < 14) return "A";
  if (h >= 14 && h < 22) return "B";
  return "C";
}

// ---------------------------------------------------------------------------
// Fetch rows from CUSTOM_TABLE03 and convert to Reading[]
// ---------------------------------------------------------------------------

interface TableRow {
  _id: string;
  devID: string;
  data: Record<string, any>;
  createdAt?: string;
}

interface TableResponse {
  success: boolean;
  data: {
    totalCount: number;
    rows: TableRow[];
  };
}

// In-memory cache by deviceId so multiple tabs sharing a device don't
// repeat the same paginated fetch. Failures are NOT cached — a rejected or
// empty result evicts the entry so the next call retries fresh.
const readingsCache = new Map<string, Promise<Reading[]>>();

export function clearReadingsCache(deviceId?: string) {
  if (deviceId) readingsCache.delete(deviceId);
  else readingsCache.clear();
}

export async function fetchReadings(_sensorMap: SensorMap, deviceId: string = DEVICE_ID): Promise<Reading[]> {
  const cached = readingsCache.get(deviceId);
  if (cached) return cached;
  const p = fetchReadingsUncached(deviceId).catch((e) => {
    readingsCache.delete(deviceId);
    throw e;
  });
  readingsCache.set(deviceId, p);
  return p;
}

async function fetchReadingsUncached(deviceId: string): Promise<Reading[]> {
  const layout = DEVICE_LAYOUTS[deviceId] ?? { values: {} };
  const valueCols  = layout.values;
  const senCols    = layout.sensory ?? {};
  const metaCols   = layout.meta ?? {};
  // Paginate — fetch up to 500 rows per call.
  // We pull all rows and filter client-side (total ~2400, fine for a POC).
  const PAGE_SIZE = 500;
  let page = 1;
  let allRows: TableRow[] = [];

  while (true) {
    const body = {
      devID: deviceId,
      page,
      limit: PAGE_SIZE,
      rawData: true, // required by the API validator
    };

    const res = await apiFetch<TableResponse>("/account/table/getRows3", {
      method: "PUT",
      body,
    });

    console.log(`[IOsense] page=${page} success=${res?.success} rows=${res?.data?.rows?.length ?? 0} totalCount=${res?.data?.totalCount ?? "?"}`);
    if (page === 1) {
      console.log("[IOsense] First row sample:", res?.data?.rows?.[0]);
    }

    if (!res.success || !res.data?.rows) break;

    allRows = allRows.concat(res.data.rows);
    if (allRows.length >= res.data.totalCount || res.data.rows.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`[IOsense] Total rows fetched (raw): ${allRows.length}`);

  // Deduplicate by _id — pagination can return overlapping rows
  const seen = new Set<string>();
  const uniqueRows = allRows.filter((r) => {
    if (seen.has(r._id)) return false;
    seen.add(r._id);
    return true;
  });
  console.log(`[IOsense] After _id dedup: ${uniqueRows.length}`);

  // Convert each row to a Reading
  const readings: Reading[] = [];
  let droppedNoTs = 0;

  for (const row of uniqueRows) {
    const d = row.data ?? {};

    // Timestamp from D0
    const tsRaw = d.D0 ?? row.createdAt ?? "";
    const ts = parseTime(tsRaw);
    if (isNaN(ts)) {
      droppedNoTs++;
      if (droppedNoTs <= 3) {
        console.warn(`[IOsense] Could not parse timestamp:`, JSON.stringify(tsRaw), "row:", row._id);
      }
      continue;
    }

    // QC values
    const values: Partial<Record<ParamKey, number>> = {};
    for (const [sensor, paramKey] of Object.entries(valueCols)) {
      const raw = d[sensor];
      const num = typeof raw === "number" ? raw : parseFloat(raw);
      if (!isNaN(num)) values[paramKey] = num;
    }

    // Sensory fields
    const appearance = senCols.appearance ? (d[senCols.appearance] ?? "Clear")  : "Clear";
    const odor       = senCols.odor       ? (d[senCols.odor]       ?? "Normal") : "Normal";
    const taste      = senCols.taste      ? (d[senCols.taste]      ?? "Normal") : "Normal";

    // Operator / metadata
    const remarks     = (metaCols.remarks     ? d[metaCols.remarks]     : "") ?.toString().trim() ?? "";
    const qaExecutive = (metaCols.qaExecutive ? d[metaCols.qaExecutive] : "") ?.toString().trim() ?? "";
    const teamLeader  = (metaCols.teamLeader  ? d[metaCols.teamLeader]  : "") ?.toString().trim() ?? "";
    const operator = qaExecutive || teamLeader || "";

    readings.push({
      ts,
      values,
      sensory: { appearance, odor, taste },
      shift: shiftFor(ts),
      operator,
      remarks,
      qaExecutive,
      teamLeader,
    });
  }

  // Merge readings that share the exact same timestamp.
  // This happens when the CT03 table stores multiple rows for the same
  // time slot (e.g. separate entries for sensory vs physical data).
  const byTs = new Map<number, Reading>();
  for (const r of readings) {
    const existing = byTs.get(r.ts);
    if (existing) {
      Object.assign(existing.values, r.values);
      if (r.remarks && !existing.remarks) existing.remarks = r.remarks;
      if (r.qaExecutive && !existing.qaExecutive) existing.qaExecutive = r.qaExecutive;
      if (r.teamLeader && !existing.teamLeader) existing.teamLeader = r.teamLeader;
      if (r.operator && !existing.operator) existing.operator = r.operator;
      existing.sensory = {
        appearance: r.sensory.appearance !== "Clear" ? r.sensory.appearance : existing.sensory.appearance,
        odor: r.sensory.odor !== "Normal" ? r.sensory.odor : existing.sensory.odor,
        taste: r.sensory.taste !== "Normal" ? r.sensory.taste : existing.sensory.taste,
      };
    } else {
      byTs.set(r.ts, r);
    }
  }

  const merged = Array.from(byTs.values());
  merged.sort((a, b) => a.ts - b.ts);
  console.log(
    `[IOsense] Parsed readings: ${readings.length}` +
    (droppedNoTs ? ` (dropped ${droppedNoTs} with unparseable timestamps)` : "") +
    ` · After timestamp merge: ${merged.length}`
  );
  if (merged[0]) {
    console.log(`[IOsense] First reading ts=${new Date(merged[0].ts).toISOString()}`,
      "values:", Object.keys(merged[0].values).length);
  }
  return merged;
}
