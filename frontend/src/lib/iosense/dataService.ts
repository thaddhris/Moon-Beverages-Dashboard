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
// Fixed sensor → ParamKey mapping for TREATED_WATER_COLA
// D0  = DATE (row timestamp)
// D1  = Appearance, D2 = Odor, D3 = Taste (sensory)
// D4–D17 = QC params
// D171 = Remarks, D172 = QA Executive, D173 = Team Leader
// ---------------------------------------------------------------------------

export const SENSOR_TO_PARAM: Record<string, ParamKey> = {
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
};

// For compatibility with page.tsx SensorMap type
export type SensorMap = Record<string, ParamKey>;

// autoMapSensors is no longer name-based — just return the fixed map
export function autoMapSensors(_sensors: any[]): SensorMap {
  return { ...SENSOR_TO_PARAM };
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

export function parseTime(t: string | number): number {
  if (typeof t === "number") return t;
  if (!t) return NaN;

  // YYYY-MM-DD HH:MM:SS  (actual format used by TREATED_WATER_COLA)
  // Timestamps are IST (UTC+05:30) — the plant is in India.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})$/.exec(t);
  if (ymd) {
    return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T${ymd[4]}+05:30`).getTime();
  }

  // DD/MM/YYYY HH:MM:SS  (fallback — some rows may still use this)
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/.exec(t);
  if (dmy) {
    return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}+05:30`).getTime();
  }

  return new Date(t).getTime();
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

export async function fetchReadings(_sensorMap: SensorMap): Promise<Reading[]> {
  // Paginate — fetch up to 500 rows per call.
  // We pull all rows and filter client-side (total ~2400, fine for a POC).
  const PAGE_SIZE = 500;
  let page = 1;
  let allRows: TableRow[] = [];

  while (true) {
    const body = {
      devID: DEVICE_ID,
      page,
      limit: PAGE_SIZE,
      rawData: true, // required by the API validator
    };

    const res = await apiFetch<TableResponse>("/account/table/getRows3", {
      method: "PUT",
      body,
    });

    if (!res.success || !res.data?.rows) break;

    allRows = allRows.concat(res.data.rows);
    if (allRows.length >= res.data.totalCount || res.data.rows.length < PAGE_SIZE) break;
    page++;
  }

  // Deduplicate by _id — pagination can return overlapping rows
  const seen = new Set<string>();
  const uniqueRows = allRows.filter((r) => {
    if (seen.has(r._id)) return false;
    seen.add(r._id);
    return true;
  });

  // Convert each row to a Reading
  const readings: Reading[] = [];

  for (const row of uniqueRows) {
    const d = row.data ?? {};

    // Timestamp from D0
    const ts = parseTime(d.D0 ?? row.createdAt ?? "");
    if (isNaN(ts)) continue;

    // QC values
    const values: Partial<Record<ParamKey, number>> = {};
    for (const [sensor, paramKey] of Object.entries(SENSOR_TO_PARAM)) {
      const raw = d[sensor];
      const num = typeof raw === "number" ? raw : parseFloat(raw);
      if (!isNaN(num)) values[paramKey] = num;
    }

    // Sensory fields
    const appearance = d.D1 ?? "Clear";
    const odor       = d.D2 ?? "Normal";
    const taste      = d.D3 ?? "Normal";

    // Operator / metadata
    const remarks     = (d.D171 ?? "").toString().trim();
    const qaExecutive = (d.D172 ?? "").toString().trim();
    const teamLeader  = (d.D173 ?? "").toString().trim();
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
  return merged;
}
