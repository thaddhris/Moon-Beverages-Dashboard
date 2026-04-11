"use client";

import { useMemo } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, NOW_TS } from "../lib/mockData";
import { TimeRange } from "./TimePicker";

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  timeRange: TimeRange;
  bufferPct: number;
  onSelectParam?: (key: string) => void;
}

const SLOT_HOURS = [0, 4, 8, 12, 16, 20];
const DAY_MS = 24 * 60 * 60 * 1000;
const TOLERANCE_MS = 2.1 * 3600 * 1000;

interface SlotReading {
  v: number;
  ts: number;
  operator: string;
  shift: string;
}

function getDays(startTs: number, endTs: number): number[] {
  const startDay = Math.floor(startTs / DAY_MS) * DAY_MS;
  const endDay = Math.floor(endTs / DAY_MS) * DAY_MS;
  const n = Math.max(1, Math.round((endDay - startDay) / DAY_MS) + 1);
  // Newest first: today, yesterday, day before, ...
  return Array.from({ length: n }, (_, i) => endDay - i * DAY_MS);
}

function findSlotReading(readings: Reading[], key: string, slotTs: number): SlotReading | null {
  let best: SlotReading | null = null;
  let bestDiff = TOLERANCE_MS;
  for (const r of readings) {
    const diff = Math.abs(r.ts - slotTs);
    if (diff < bestDiff) {
      const v = (r.values as any)[key];
      if (v !== undefined) {
        bestDiff = diff;
        best = { v, ts: r.ts, operator: r.operator, shift: r.shift };
      }
    }
  }
  return best;
}

function findDailyReading(readings: Reading[], key: string, dayStart: number): SlotReading | null {
  const dayEnd = dayStart + DAY_MS;
  for (const r of readings) {
    if (r.ts >= dayStart && r.ts < dayEnd) {
      const v = (r.values as any)[key];
      if (v !== undefined) return { v, ts: r.ts, operator: r.operator, shift: r.shift };
    }
  }
  return null;
}

function findSensoryReading(readings: Reading[], slotTs: number): Reading | null {
  let best: Reading | null = null;
  let bestDiff = TOLERANCE_MS;
  for (const r of readings) {
    const diff = Math.abs(r.ts - slotTs);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return best;
}

function cellStatus(spec: ParamSpec, v: number | undefined, bufferPct: number): "ok" | "warn" | "breach" | "nil-ok" | "nil-breach" | "empty" {
  if (v === undefined) return "empty";
  if (spec.nilSpec) return v > spec.max ? "nil-breach" : "nil-ok";
  if (v < spec.min || v > spec.max) return "breach";
  const span = spec.max - spec.min;
  const buf = (span * bufferPct) / 100;
  if (v < spec.min + buf || v > spec.max - buf) return "warn";
  return "ok";
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  ok:          { bg: "#f3fbf6", text: "#166534", dot: "#22c55e" },
  warn:        { bg: "#fefce8", text: "#854d0e", dot: "#f59e0b" },
  breach:      { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  "nil-ok":    { bg: "#f3fbf6", text: "#166534", dot: "#22c55e" },
  "nil-breach":{ bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  empty:       { bg: "transparent", text: "#9ca3af", dot: "transparent" },
};

function sensoryStatus(value: string): "ok" | "breach" {
  return ["Clear", "Normal", "Agreeable"].includes(value) ? "ok" : "breach";
}

function fmtValue(spec: ParamSpec, v: number): string {
  if (spec.nilSpec) return v > spec.max ? v.toFixed(spec.decimals) : "NIL";
  return v.toFixed(spec.decimals);
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

const STICKY_COL_1 = { position: "sticky" as const, left: 0, zIndex: 15 };
const STICKY_COL_2 = { position: "sticky" as const, left: 200, zIndex: 15 };
const STICKY_COL_3 = { position: "sticky" as const, left: 272, zIndex: 15 };

export function FormView({ params, readings, timeRange, bufferPct, onSelectParam }: Props) {
  const days = useMemo(() => getDays(timeRange.startTs, timeRange.endTs), [timeRange]);
  const totalSlotCols = days.length * SLOT_HOURS.length;
  const hourlyParams = params.filter((p) => p.frequency === "4h");
  const dailyParams = params.filter((p) => p.frequency === "daily");

  // For every (day, slot) pair, find the nearest reading within tolerance
  // and use its actual timestamp as the column label. This replaces the
  // hardcoded 00:00 / 04:00 / … slot labels with the real log time.
  const slotActualTimes = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const dayTs of days) {
      for (const h of SLOT_HOURS) {
        const slotTs = dayTs + h * 3600 * 1000;
        let best: Reading | null = null;
        let bestDiff = TOLERANCE_MS;
        for (const r of readings) {
          const diff = Math.abs(r.ts - slotTs);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = r;
          }
        }
        map[`${dayTs}-${h}`] = best ? best.ts : null;
      }
    }
    return map;
  }, [days, readings]);

  const sensoryRows = [
    { key: "appearance", label: "Appearance", spec: "Clear" },
    { key: "odor", label: "Odor", spec: "Normal" },
    { key: "taste", label: "Taste", spec: "Agreeable" },
  ];

  const headerBg = "#f8fafc";
  const cellBorder = "1px solid #e2e8f0";

  return (
    <div className="mx-auto px-6 py-6">
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {/* Sheet header */}
        <div style={{ borderBottom: cellBorder, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", fontWeight: 500 }}>Moon Beverages · QC Log</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>Treated Water Analysis — After 1 Micron</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>Date range</div>
            <div style={{ fontSize: 12, color: "#334155", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>
              {fmtDate(timeRange.startTs)} → {fmtDate(timeRange.endTs)}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ borderBottom: cellBorder, padding: "8px 24px", display: "flex", gap: 20, background: "#fafbfc" }}>
          {[
            { color: "#22c55e", bg: "#f3fbf6", label: "In Control" },
            { color: "#f59e0b", bg: "#fefce8", label: "At Risk" },
            { color: "#ef4444", bg: "#fef2f2", label: "Out of Specification" },
          ].map(({ color, bg, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
              <div style={{ width: 28, height: 16, background: bg, border: `1.5px solid ${color}`, borderRadius: 3 }} />
              {label}
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>Hover cells for timestamp · operator · shift</div>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums", tableLayout: "fixed", minWidth: 200 + 72 + 120 + totalSlotCols * 72 }}>
            {/* Colgroup */}
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 120 }} />
              {days.flatMap((_, di) => SLOT_HOURS.map((_, si) => <col key={`${di}-${si}`} style={{ width: 72 }} />))}
            </colgroup>

            <thead>
              {/* ── Row 1: Day labels ── */}
              <tr>
                <th style={{ ...STICKY_COL_1, background: headerBg, border: cellBorder, padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#475569", letterSpacing: "0.04em" }}>
                  PARAMETER
                </th>
                <th style={{ ...STICKY_COL_2, background: headerBg, border: cellBorder, padding: "8px 6px", textAlign: "center", fontWeight: 500, fontSize: 11, color: "#64748b" }}>
                  FREQ
                </th>
                <th style={{ ...STICKY_COL_3, background: headerBg, border: cellBorder, padding: "8px 10px", textAlign: "center", fontWeight: 500, fontSize: 11, color: "#64748b" }}>
                  SPECIFICATION
                </th>
                {days.map((dayTs, di) => {
                  const isToday = Math.floor(NOW_TS / DAY_MS) === Math.floor(dayTs / DAY_MS);
                  return (
                    <th
                      key={di}
                      colSpan={SLOT_HOURS.length}
                      style={{
                        border: cellBorder,
                        padding: "8px 4px",
                        textAlign: "center",
                        fontWeight: 600,
                        fontSize: 11,
                        background: isToday ? "#eff6ff" : headerBg,
                        color: isToday ? "#1d4ed8" : "#334155",
                        borderBottom: isToday ? "2px solid #3b82f6" : cellBorder,
                      }}
                    >
                      {fmtDate(dayTs)}{isToday ? " ★" : ""}
                    </th>
                  );
                })}
              </tr>

              {/* ── Row 2: Time slots — actual log time when available ── */}
              <tr>
                <th style={{ ...STICKY_COL_1, background: headerBg, border: cellBorder }} />
                <th style={{ ...STICKY_COL_2, background: headerBg, border: cellBorder }} />
                <th style={{ ...STICKY_COL_3, background: headerBg, border: cellBorder }} />
                {days.flatMap((dayTs, di) =>
                  SLOT_HOURS.map((h, si) => {
                    const actualTs = slotActualTimes[`${dayTs}-${h}`];
                    const nominal = `${String(h).padStart(2, "0")}:00`;
                    const label = actualTs !== null ? fmtTime(actualTs) : nominal;
                    return (
                      <th
                        key={`${di}-${si}`}
                        title={actualTs !== null ? `Logged at ${label}` : `Scheduled slot ${nominal}`}
                        style={{
                          border: cellBorder,
                          padding: "5px 2px",
                          textAlign: "center",
                          fontSize: 10,
                          fontWeight: actualTs !== null ? 500 : 400,
                          color: actualTs !== null ? "#475569" : "#cbd5e1",
                          background: headerBg,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    );
                  })
                )}
              </tr>
            </thead>

            <tbody>
              {/* ── Sensory group ── */}
              <GroupRow label="Sensory" colSpan={3 + totalSlotCols} />
              {sensoryRows.map((row) => (
                <tr key={row.key} style={{ transition: "background 0.1s" }}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: "7px 14px", fontWeight: 500, color: "#1e293b" }}>{row.label}</td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>4 Hrs</td>
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b" }}>{row.spec}</td>
                  {days.flatMap((dayTs, di) =>
                    SLOT_HOURS.map((h, si) => {
                      const slotTs = dayTs + h * 3600 * 1000;
                      const r = findSensoryReading(readings, slotTs);
                      const val = r?.sensory[row.key as keyof typeof r.sensory];
                      const st = val ? sensoryStatus(val) : "empty";
                      const style = STATUS_STYLE[st];
                      const isFuture = slotTs > NOW_TS;
                      return (
                        <td
                          key={`${di}-${si}`}
                          title={r ? `${fmtTime(r.ts)} · ${r.operator} · Shift ${r.shift}` : ""}
                          style={{
                            border: cellBorder,
                            padding: "7px 3px",
                            textAlign: "center",
                            background: isFuture ? "#f8fafc" : (val ? style.bg : "white"),
                            color: isFuture ? "#cbd5e1" : style.text,
                            fontSize: 11,
                          }}
                        >
                          {isFuture ? "" : val ? <span style={{ fontWeight: 500 }}>{val.slice(0, 6)}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}

              {/* ── 4-hourly params ── */}
              <GroupRow label="Physical & Chemical · 4-Hourly" colSpan={3 + totalSlotCols} />
              {hourlyParams.map((p) => (
                <tr key={p.key}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: 0, fontWeight: 500, color: "#1e293b" }}>
                    <ParamLabelCell label={p.label} onClick={onSelectParam ? () => onSelectParam(p.key) : undefined} />
                  </td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>4 Hrs</td>
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b", fontSize: 11 }}>{p.specDisplay}</td>
                  {days.flatMap((dayTs, di) =>
                    SLOT_HOURS.map((h, si) => {
                      const slotTs = dayTs + h * 3600 * 1000;
                      const isFuture = slotTs > NOW_TS;
                      const reading = isFuture ? null : findSlotReading(readings, p.key, slotTs);
                      const st = reading ? cellStatus(p, reading.v, bufferPct) : "empty";
                      const style = STATUS_STYLE[st];
                      return (
                        <td
                          key={`${di}-${si}`}
                          title={reading ? `${fmtTime(reading.ts)} · ${reading.operator} · Shift ${reading.shift}\n${p.label}: ${reading.v.toFixed(p.decimals)} ${p.unit}` : ""}
                          style={{
                            border: cellBorder,
                            padding: "7px 3px",
                            textAlign: "center",
                            background: isFuture ? "#f8fafc" : (reading ? style.bg : "white"),
                          }}
                        >
                          {isFuture ? (
                            ""
                          ) : reading ? (
                            <span style={{ fontWeight: 600, fontSize: 11, color: style.text }}>
                              {fmtValue(p, reading.v)}
                            </span>
                          ) : (
                            <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}

              {/* ── Daily params ── */}
              <GroupRow label="Chemical · Daily" colSpan={3 + totalSlotCols} />
              {dailyParams.map((p) => (
                <tr key={p.key}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: 0, fontWeight: 500, color: "#1e293b" }}>
                    <ParamLabelCell label={p.label} onClick={onSelectParam ? () => onSelectParam(p.key) : undefined} />
                  </td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>Daily</td>
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b", fontSize: 11 }}>{p.specDisplay}</td>
                  {days.map((dayTs, di) => {
                    const isFuture = dayTs + 8 * 3600 * 1000 > NOW_TS;
                    const reading = isFuture ? null : findDailyReading(readings, p.key, dayTs);
                    const st = reading ? cellStatus(p, reading.v, bufferPct) : "empty";
                    const style = STATUS_STYLE[st];
                    return (
                      <td
                        key={di}
                        colSpan={SLOT_HOURS.length}
                        title={reading ? `${fmtDate(reading.ts)} ${fmtTime(reading.ts)} · ${reading.operator} · Shift ${reading.shift}\n${p.label}: ${reading.v.toFixed(p.decimals)} ${p.unit}` : ""}
                        style={{
                          border: cellBorder,
                          padding: "7px 6px",
                          textAlign: "center",
                          background: isFuture ? "#f8fafc" : (reading ? style.bg : "white"),
                        }}
                      >
                        {isFuture ? (
                          ""
                        ) : reading ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: 12, color: style.text }}>
                              {reading.v.toFixed(p.decimals)} <span style={{ fontWeight: 400, fontSize: 10, color: style.text, opacity: 0.7 }}>{p.unit}</span>
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* ── Footer rows (D171 Remarks, D172 QA Executive, D173 Team Leader) ─
                   Each 4-hour slot gets its own value, matched to the same reading
                   that populated the parameter columns above. ── */}
              {([
                { label: "Remarks",      field: "remarks"     as const, light: true },
                { label: "QA Executive", field: "qaExecutive" as const, light: false },
                { label: "Team Leader",  field: "teamLeader"  as const, light: false },
              ]).map(({ label, field, light }) => (
                <tr key={label}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: "10px 14px", color: "#64748b", fontStyle: "italic", fontSize: 12 }}>
                    {label}
                  </td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder }} />
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder }} />
                  {days.flatMap((dayTs, di) =>
                    SLOT_HOURS.map((h, si) => {
                      const slotTs = dayTs + h * 3600 * 1000;
                      const isFuture = slotTs > NOW_TS;
                      // Find the reading closest to this slot (within ±2.1h),
                      // the same one used for the 4-hourly parameter columns.
                      let best: Reading | null = null;
                      let bestDiff = TOLERANCE_MS;
                      if (!isFuture) {
                        for (const r of readings) {
                          const diff = Math.abs(r.ts - slotTs);
                          if (diff < bestDiff) {
                            bestDiff = diff;
                            best = r;
                          }
                        }
                      }
                      const val = best ? ((best as any)[field] as string | undefined) : undefined;
                      return (
                        <td
                          key={`${di}-${si}`}
                          title={val || ""}
                          style={{
                            border: cellBorder,
                            padding: "10px 6px",
                            textAlign: "center",
                            background: isFuture ? "#f8fafc" : (light ? "#fafbfc" : "white"),
                            color: "#475569",
                            fontSize: 11,
                            maxWidth: 72,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isFuture ? "" : val || <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ParamLabelCell({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) {
    return <div style={{ padding: "7px 14px" }}>{label}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="View details"
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        boxSizing: "border-box",
        padding: "7px 14px",
        cursor: "pointer",
        fontWeight: 500,
        color: "#1e293b",
        fontSize: 12,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#1d4ed8";
        const arrow = e.currentTarget.querySelector("[data-arrow]") as HTMLElement | null;
        if (arrow) arrow.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#1e293b";
        const arrow = e.currentTarget.querySelector("[data-arrow]") as HTMLElement | null;
        if (arrow) arrow.style.opacity = "0";
      }}
    >
      <span style={{ textDecoration: "underline", textDecorationColor: "#cbd5e1", textUnderlineOffset: 3 }}>{label}</span>
      <span data-arrow style={{ opacity: 0, transition: "opacity 0.12s", fontSize: 11, color: "#1d4ed8" }}>→</span>
    </button>
  );
}

function GroupRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: 0,
          background: "#f1f5f9",
          borderTop: "2px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {/* Sticky wrapper keeps the label pinned to the viewport as the table scrolls horizontally */}
        <div
          style={{
            position: "sticky",
            left: 0,
            padding: "5px 14px",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#64748b",
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {label}
        </div>
      </td>
    </tr>
  );
}
