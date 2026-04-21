import { Reading, NOW_TS } from "./mockData";
import { startOfIstDay, istHours, DAY_MS } from "./ist";

// 6 × 4-hour slots per day (IST local hours)
export const SLOTS: { start: number; end: number; label: string }[] = [
  { start: 0,  end: 4,  label: "00–04" },
  { start: 4,  end: 8,  label: "04–08" },
  { start: 8,  end: 12, label: "08–12" },
  { start: 12, end: 16, label: "12–16" },
  { start: 16, end: 20, label: "16–20" },
  { start: 20, end: 24, label: "20–24" },
];

export type SlotStatus = "filled" | "multi" | "missed" | "future";

export interface SlotInfo {
  slotIndex: number;
  label: string;
  count: number;
  status: SlotStatus;
}

export function slotIndexFor(ts: number): number {
  const h = istHours(ts);
  return Math.floor(h / 4);
}

// Per-day slot breakdown. Readings are pre-filtered to one day when possible;
// otherwise we filter internally.
export function slotStatusForDay(dayTs: number, readings: Reading[]): SlotInfo[] {
  const dayStart = startOfIstDay(dayTs);
  const dayEnd = dayStart + DAY_MS;
  const nowDayStart = startOfIstDay(NOW_TS);
  const isToday = dayStart === nowDayStart;
  const isFutureDay = dayStart > nowDayStart;

  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of readings) {
    if (r.ts < dayStart || r.ts >= dayEnd) continue;
    const idx = slotIndexFor(r.ts);
    if (idx >= 0 && idx < 6) counts[idx]++;
  }

  const currentSlot = isToday ? slotIndexFor(NOW_TS) : -1;

  return SLOTS.map((s, i) => {
    let status: SlotStatus;
    if (isFutureDay) status = "future";
    else if (isToday && i > currentSlot) status = "future";
    else if (counts[i] === 0) status = "missed";
    else if (counts[i] > 1) status = "multi";
    else status = "filled";
    return { slotIndex: i, label: s.label, count: counts[i], status };
  });
}

export interface SubmissionStats {
  expected: number; // slots that have already elapsed
  filled: number;   // distinct slots with at least one submission
  missed: number;   // elapsed slots with zero submissions
  multi: number;    // slots with more than one submission
  totalSubmissions: number;
}

export function submissionStatsForRange(
  readings: Reading[],
  startTs: number,
  endTs: number
): SubmissionStats {
  const startDay = startOfIstDay(startTs);
  const endDay = startOfIstDay(endTs);
  const nowDayStart = startOfIstDay(NOW_TS);
  const nowSlot = slotIndexFor(NOW_TS);

  let expected = 0;
  let filled = 0;
  let missed = 0;
  let multi = 0;
  let totalSubmissions = 0;

  for (let d = startDay; d <= endDay; d += DAY_MS) {
    if (d > nowDayStart) break;
    const dayReadings = readings.filter((r) => r.ts >= d && r.ts < d + DAY_MS);
    const slots = slotStatusForDay(d, dayReadings);
    for (const s of slots) {
      if (s.status === "future") continue;
      expected++;
      totalSubmissions += s.count;
      if (s.status === "filled") filled++;
      if (s.status === "multi") { filled++; multi++; }
      if (s.status === "missed") missed++;
    }
    // If today, only count up to current slot
    if (d === nowDayStart) {
      // Adjust: slotStatusForDay already sets future on post-current slots
    }
  }

  return { expected, filled, missed, multi, totalSubmissions };
}
