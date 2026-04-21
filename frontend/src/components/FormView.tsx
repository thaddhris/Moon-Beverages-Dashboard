"use client";

import { useMemo } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, NOW_TS } from "../lib/mockData";
import { TimeRange } from "./TimePicker";
import { fmtDateIST, fmtTimeIST, startOfIstDay, DAY_MS as IST_DAY_MS } from "../lib/ist";

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  timeRange: TimeRange;
  bufferPct: number;
  onSelectParam?: (key: string) => void;
  waterLabel?: string;
  waterSubtitle?: string;
}

const DAY_MS = IST_DAY_MS;
const COL_W = 82;

function getDays(startTs: number, endTs: number): number[] {
  const startDay = startOfIstDay(startTs);
  const endDay = startOfIstDay(endTs);
  const n = Math.max(1, Math.round((endDay - startDay) / DAY_MS) + 1);
  return Array.from({ length: n }, (_, i) => endDay - i * DAY_MS);
}

function cellStatus(
  spec: ParamSpec,
  v: number | undefined,
  bufferPct: number
): "ok" | "warn" | "breach" | "nil-ok" | "nil-breach" | "empty" {
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

const STICKY_COL_1 = { position: "sticky" as const, left: 0, zIndex: 15 };
const STICKY_COL_2 = { position: "sticky" as const, left: 200, zIndex: 15 };
const STICKY_COL_3 = { position: "sticky" as const, left: 272, zIndex: 15 };

export function FormView({ params, readings, timeRange, bufferPct, onSelectParam, waterLabel, waterSubtitle }: Props) {
  const days = useMemo(() => getDays(timeRange.startTs, timeRange.endTs), [timeRange]);
  const hourlyParams = params.filter((p) => p.frequency === "4h");
  const dailyParams = params.filter((p) => p.frequency === "daily");

  // Build a map: dayTs → sorted array of readings for that day
  const dayReadings = useMemo(() => {
    const map = new Map<number, Reading[]>();
    for (const dayTs of days) map.set(dayTs, []);
    for (const r of readings) {
      const dayTs = startOfIstDay(r.ts);
      const arr = map.get(dayTs);
      if (arr) arr.push(r);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.ts - b.ts);
    return map;
  }, [days, readings]);

  // The max number of entries in any single day determines how many columns per day
  const colsPerDay = useMemo(() => {
    let max = 1;
    for (const arr of dayReadings.values()) max = Math.max(max, arr.length);
    return max;
  }, [dayReadings]);

  const totalCols = days.length * colsPerDay;

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
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", fontWeight: 500 }}>
              Moon Beverages · QC Log{waterLabel ? ` · ${waterLabel}` : ""}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
              {waterSubtitle ?? "Treated Water Analysis — After 1 Micron"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>Date range</div>
            <div style={{ fontSize: 12, color: "#334155", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>
              {fmtDateIST(timeRange.startTs)} → {fmtDateIST(timeRange.endTs)}
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
          <table style={{ borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums", tableLayout: "fixed", minWidth: 200 + 72 + 120 + totalCols * COL_W }}>
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 120 }} />
              {Array.from({ length: totalCols }, (_, i) => (
                <col key={i} style={{ width: COL_W }} />
              ))}
            </colgroup>

            <thead>
              {/* Row 1: Day labels */}
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
                  const isToday = startOfIstDay(NOW_TS) === dayTs;
                  return (
                    <th
                      key={di}
                      colSpan={colsPerDay}
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
                      {fmtDateIST(dayTs)}{isToday ? " ★" : ""}
                    </th>
                  );
                })}
              </tr>

              {/* Row 2: Actual reading timestamps */}
              <tr>
                <th style={{ ...STICKY_COL_1, background: headerBg, border: cellBorder }} />
                <th style={{ ...STICKY_COL_2, background: headerBg, border: cellBorder }} />
                <th style={{ ...STICKY_COL_3, background: headerBg, border: cellBorder }} />
                {days.flatMap((dayTs, di) => {
                  const rArr = dayReadings.get(dayTs) ?? [];
                  return Array.from({ length: colsPerDay }, (_, ci) => {
                    const r = rArr[ci];
                    return (
                      <th
                        key={`${di}-${ci}`}
                        title={r ? `Logged at ${fmtTimeIST(r.ts)}` : ""}
                        style={{
                          border: cellBorder,
                          padding: "5px 2px",
                          textAlign: "center",
                          fontSize: 10,
                          fontWeight: r ? 500 : 400,
                          color: r ? "#475569" : "#cbd5e1",
                          background: headerBg,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r ? fmtTimeIST(r.ts) : "—"}
                      </th>
                    );
                  });
                })}
              </tr>
            </thead>

            <tbody>
              {/* Sensory group */}
              <GroupRow label="Sensory" colSpan={3 + totalCols} />
              {sensoryRows.map((row) => (
                <tr key={row.key}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: "7px 14px", fontWeight: 500, color: "#1e293b" }}>{row.label}</td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>Per Entry</td>
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b" }}>{row.spec}</td>
                  {days.flatMap((dayTs, di) => {
                    const rArr = dayReadings.get(dayTs) ?? [];
                    return Array.from({ length: colsPerDay }, (_, ci) => {
                      const r = rArr[ci];
                      const val = r?.sensory[row.key as keyof typeof r.sensory];
                      const st = val ? sensoryStatus(val) : "empty";
                      const style = STATUS_STYLE[st];
                      return (
                        <td
                          key={`${di}-${ci}`}
                          title={r && r.sensory[row.key as keyof typeof r.sensory] ? r.sensory[row.key as keyof typeof r.sensory] : ""}
                          style={{
                            border: cellBorder,
                            padding: "7px 3px",
                            textAlign: "center",
                            background: r ? style.bg : "white",
                            color: style.text,
                            fontSize: 11,
                          }}
                        >
                          {val ? <span style={{ fontWeight: 500 }}>{val.slice(0, 6)}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}

              {/* 4-hourly / per-entry params */}
              <GroupRow label="Physical & Chemical" colSpan={3 + totalCols} />
              {hourlyParams.map((p) => (
                <tr key={p.key}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: 0, fontWeight: 500, color: "#1e293b" }}>
                    <ParamLabelCell label={p.label} onClick={onSelectParam ? () => onSelectParam(p.key) : undefined} />
                  </td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>Per Entry</td>
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b", fontSize: 11 }}>{p.specDisplay}</td>
                  {days.flatMap((dayTs, di) => {
                    const rArr = dayReadings.get(dayTs) ?? [];
                    return Array.from({ length: colsPerDay }, (_, ci) => {
                      const r = rArr[ci];
                      const v = r ? (r.values as any)[p.key] as number | undefined : undefined;
                      const st = cellStatus(p, v, bufferPct);
                      const style = STATUS_STYLE[st];
                      return (
                        <td
                          key={`${di}-${ci}`}
                          title={v !== undefined ? `${v.toFixed(p.decimals)} ${p.unit}` : ""}
                          style={{
                            border: cellBorder,
                            padding: "7px 3px",
                            textAlign: "center",
                            background: v !== undefined ? style.bg : "white",
                          }}
                        >
                          {v !== undefined ? (
                            <span style={{ fontWeight: 600, fontSize: 11, color: style.text }}>
                              {fmtValue(p, v)}
                            </span>
                          ) : (
                            <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                          )}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}

              {/* Daily / chemical params */}
              <GroupRow label="Chemical · Daily" colSpan={3 + totalCols} />
              {dailyParams.map((p) => (
                <tr key={p.key}>
                  <td style={{ ...STICKY_COL_1, background: "white", border: cellBorder, padding: 0, fontWeight: 500, color: "#1e293b" }}>
                    <ParamLabelCell label={p.label} onClick={onSelectParam ? () => onSelectParam(p.key) : undefined} />
                  </td>
                  <td style={{ ...STICKY_COL_2, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>Daily</td>
                  <td style={{ ...STICKY_COL_3, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b", fontSize: 11 }}>{p.specDisplay}</td>
                  {days.map((dayTs, di) => {
                    const rArr = dayReadings.get(dayTs) ?? [];
                    // For daily params, find the first reading that has a value
                    const r = rArr.find((r) => (r.values as any)[p.key] !== undefined);
                    const v = r ? (r.values as any)[p.key] as number | undefined : undefined;
                    const st = cellStatus(p, v, bufferPct);
                    const style = STATUS_STYLE[st];
                    return (
                      <td
                        key={di}
                        colSpan={colsPerDay}
                        title={v !== undefined ? `${v.toFixed(p.decimals)} ${p.unit}` : ""}
                        style={{
                          border: cellBorder,
                          padding: "7px 6px",
                          textAlign: "center",
                          background: v !== undefined ? style.bg : "white",
                        }}
                      >
                        {v !== undefined ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: 12, color: style.text }}>
                              {v.toFixed(p.decimals)} <span style={{ fontWeight: 400, fontSize: 10, color: style.text, opacity: 0.7 }}>{p.unit}</span>
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

              {/* Footer: Remarks, QA Executive, Team Leader — per entry */}
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
                  {days.flatMap((dayTs, di) => {
                    const rArr = dayReadings.get(dayTs) ?? [];
                    return Array.from({ length: colsPerDay }, (_, ci) => {
                      const r = rArr[ci];
                      const val = r ? ((r as any)[field] as string | undefined) : undefined;
                      return (
                        <td
                          key={`${di}-${ci}`}
                          title={val || ""}
                          style={{
                            border: cellBorder,
                            padding: "10px 6px",
                            textAlign: "center",
                            background: light ? "#fafbfc" : "white",
                            color: "#475569",
                            fontSize: 11,
                            maxWidth: COL_W,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {val || <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                      );
                    });
                  })}
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
