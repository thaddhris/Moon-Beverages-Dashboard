"use client";

import { useMemo, useState, useEffect } from "react";
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
const CAT_ACCENTS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

function getDays(startTs: number, endTs: number): number[] {
  const startDay = startOfIstDay(startTs);
  const endDay   = startOfIstDay(endTs);
  const n = Math.max(1, Math.round((endDay - startDay) / DAY_MS) + 1);
  return Array.from({ length: n }, (_, i) => endDay - i * DAY_MS);
}


function cellStatus(
  spec: ParamSpec, v: number | undefined, bufferPct: number
): "ok" | "warn" | "breach" | "nil-ok" | "nil-breach" | "empty" {
  if (v === undefined) return "empty";
  if (spec.nilSpec) return v > spec.max ? "nil-breach" : "nil-ok";
  if (v < spec.min || v > spec.max) return "breach";
  const span = spec.max - spec.min;
  const buf  = (span * bufferPct) / 100;
  if (v < spec.min + buf || v > spec.max - buf) return "warn";
  return "ok";
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  ok:          { bg: "#f3fbf6", text: "#166534", dot: "#22c55e" },
  warn:        { bg: "#fefce8", text: "#854d0e", dot: "#f59e0b" },
  breach:      { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  "nil-ok":    { bg: "#f3fbf6", text: "#166534", dot: "#22c55e" },
  "nil-breach":{ bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  empty:       { bg: "white",   text: "#9ca3af", dot: "transparent" },
};

function sensoryStatus(v: string): "ok" | "breach" {
  return ["Clear", "Normal", "Agreeable"].includes(v) ? "ok" : "breach";
}
function fmtValue(spec: ParamSpec, v: number): string {
  if (spec.nilSpec) return v > spec.max ? v.toFixed(spec.decimals) : "NIL";
  return v.toFixed(spec.decimals);
}

const ST1 = { position: "sticky" as const, left: 0,   zIndex: 15 };
const ST2 = { position: "sticky" as const, left: 200, zIndex: 15 };
const ST3 = { position: "sticky" as const, left: 260, zIndex: 15 };
const CB  = "1px solid #e2e8f0";

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export function FormView({ params, readings, timeRange, bufferPct, onSelectParam, waterLabel, waterSubtitle }: Props) {
  const paramsByCategory = useMemo(() => {
    const map = new Map<string, ParamSpec[]>();
    for (const p of params) {
      const k = p.category ?? "__none__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [params]);

  const orderedCategories = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const p of params) {
      if (p.category && !seen.has(p.category)) { seen.add(p.category); order.push(p.category); }
    }
    return order;
  }, [params]);

  // Any water type with categories uses tabs
  if (orderedCategories.length > 0) {
    return (
      <CategoryTabs
        params={params}
        readings={readings}
        timeRange={timeRange}
        bufferPct={bufferPct}
        onSelectParam={onSelectParam}
        waterLabel={waterLabel}
        waterSubtitle={waterSubtitle}
        orderedCategories={orderedCategories}
        paramsByCategory={paramsByCategory}
      />
    );
  }

  // Treated Water: standard time-scroll table
  return (
    <StandardFormTable
      params={params}
      readings={readings}
      timeRange={timeRange}
      bufferPct={bufferPct}
      onSelectParam={onSelectParam}
      waterLabel={waterLabel}
      waterSubtitle={waterSubtitle}
    />
  );
}

// ─── Category Tabs (Raw Water, Soft Water, any categorised type) ──────────────

interface CategoryTabsProps {
  params: ParamSpec[];
  readings: Reading[];
  timeRange: TimeRange;
  bufferPct: number;
  onSelectParam?: (key: string) => void;
  waterLabel?: string;
  waterSubtitle?: string;
  orderedCategories: string[];
  paramsByCategory: Map<string, ParamSpec[]>;
}

function CategoryTabs({ params, readings, timeRange, bufferPct, onSelectParam, waterLabel, waterSubtitle, orderedCategories, paramsByCategory }: CategoryTabsProps) {
  const [activeCategory, setActiveCategory] = useState(orderedCategories[0] ?? "");

  // Reset to first tab whenever the category list changes (e.g. switching water types)
  useEffect(() => {
    setActiveCategory(orderedCategories[0] ?? "");
  }, [orderedCategories]);

  const activeParams = paramsByCategory.get(activeCategory) ?? [];

  // Hide sensory only when ALL params are weekly (no frequent readings to attach sensory to)
  const hideSensory = activeParams.length > 0 && activeParams.every((p) => p.frequency === "weekly");

  return (
    <div className="mx-auto px-6 py-6">
      {/* Category tab pills — allow horizontal scroll for many tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {orderedCategories.map((cat, ci) => {
          const accent   = CAT_ACCENTS[ci % CAT_ACCENTS.length];
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "7px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                border: `1.5px solid ${isActive ? accent : "#e2e8f0"}`,
                background: isActive ? `color-mix(in srgb, ${accent} 10%, white)` : "white",
                color: isActive ? accent : "#64748b",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Standard time-scroll table for active category */}
      <StandardFormTable
        params={activeParams}
        readings={readings}
        timeRange={timeRange}
        bufferPct={bufferPct}
        onSelectParam={onSelectParam}
        waterLabel={waterLabel}
        waterSubtitle={`${waterSubtitle ?? waterLabel ?? ""} · ${activeCategory}`}
        hideSensory={hideSensory}
      />
    </div>
  );
}

// ─── Standard time-scroll table (Treated Water + Soft Water tabs) ─────────────

interface StandardProps {
  params: ParamSpec[];
  readings: Reading[];
  timeRange: TimeRange;
  bufferPct: number;
  onSelectParam?: (key: string) => void;
  waterLabel?: string;
  waterSubtitle?: string;
  hideSensory?: boolean;
}

function StandardFormTable({ params, readings, timeRange, bufferPct, onSelectParam, waterLabel, waterSubtitle, hideSensory }: StandardProps) {
  const days = useMemo(() => getDays(timeRange.startTs, timeRange.endTs), [timeRange]);

  // 4h and 12h are both "per-entry" (each reading gets its own column)
  const hourlyParams = params.filter((p) => p.frequency === "4h" || p.frequency === "12h");
  const dailyParams  = params.filter((p) => p.frequency === "daily");
  const weeklyParams = params.filter((p) => p.frequency === "weekly");

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

  const colsPerDay = useMemo(() => {
    let max = 1;
    for (const arr of dayReadings.values()) max = Math.max(max, arr.length);
    return max;
  }, [dayReadings]);

  const totalCols = days.length * colsPerDay;
  const sensoryRows = [
    { key: "appearance", label: "Appearance", spec: "Clear" },
    { key: "odor",       label: "Odor",       spec: "Normal" },
    { key: "taste",      label: "Taste",      spec: "Agreeable" },
  ];

  return (
    <div style={{ background: "white", borderRadius: 12, border: CB, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      {/* Sheet header */}
      <div style={{ borderBottom: CB, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc" }}>
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
      <div style={{ borderBottom: CB, padding: "8px 24px", display: "flex", gap: 20, background: "#fafbfc" }}>
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
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>Hover cells for timestamp</div>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums", tableLayout: "fixed", minWidth: 200 + 72 + 120 + totalCols * COL_W }}>
          <colgroup>
            <col style={{ width: 200 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 120 }} />
            {Array.from({ length: totalCols }, (_, i) => <col key={i} style={{ width: COL_W }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...ST1, background: "#f8fafc", border: CB, padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#475569", letterSpacing: "0.04em" }}>PARAMETER</th>
              <th style={{ position: "sticky", left: 200, zIndex: 15, background: "#f8fafc", border: CB, padding: "8px 6px", textAlign: "center", fontWeight: 500, fontSize: 11, color: "#64748b" }}>FREQ</th>
              <th style={{ position: "sticky", left: 272, zIndex: 15, background: "#f8fafc", border: CB, padding: "8px 10px", textAlign: "center", fontWeight: 500, fontSize: 11, color: "#64748b" }}>SPECIFICATION</th>
              {days.map((dayTs, di) => {
                const isToday = startOfIstDay(NOW_TS) === dayTs;
                return (
                  <th key={di} colSpan={colsPerDay} style={{ border: CB, padding: "8px 4px", textAlign: "center", fontWeight: 600, fontSize: 11, background: isToday ? "#eff6ff" : "#f8fafc", color: isToday ? "#1d4ed8" : "#334155", borderBottom: isToday ? "2px solid #3b82f6" : CB }}>
                    {fmtDateIST(dayTs)}{isToday ? " ★" : ""}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th style={{ ...ST1, background: "#f8fafc", border: CB }} />
              <th style={{ position: "sticky", left: 200, zIndex: 15, background: "#f8fafc", border: CB }} />
              <th style={{ position: "sticky", left: 272, zIndex: 15, background: "#f8fafc", border: CB }} />
              {days.flatMap((dayTs, di) => {
                const rArr = dayReadings.get(dayTs) ?? [];
                return Array.from({ length: colsPerDay }, (_, ci) => {
                  const r = rArr[ci];
                  return (
                    <th key={`${di}-${ci}`} style={{ border: CB, padding: "5px 2px", textAlign: "center", fontSize: 10, fontWeight: r ? 500 : 400, color: r ? "#475569" : "#cbd5e1", background: "#f8fafc", whiteSpace: "nowrap" }}>
                      {r ? fmtTimeIST(r.ts) : "—"}
                    </th>
                  );
                });
              })}
            </tr>
          </thead>
          <tbody>
            {/* Sensory — shown for treated / soft water; hidden for raw water tabs */}
            {!hideSensory && (
              <>
                <GroupRow label="Sensory" colSpan={3 + totalCols} />
                {sensoryRows.map((row) => (
                  <tr key={row.key}>
                    <td style={{ ...ST1, background: "white", border: CB, padding: "7px 14px", fontWeight: 500, color: "#1e293b" }}>{row.label}</td>
                    <td style={{ position: "sticky", left: 200, zIndex: 15, background: "white", border: CB, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>Per Entry</td>
                    <td style={{ position: "sticky", left: 272, zIndex: 15, background: "white", border: CB, padding: "7px 10px", textAlign: "center", color: "#64748b" }}>{row.spec}</td>
                    {days.flatMap((dayTs, di) => {
                      const rArr = dayReadings.get(dayTs) ?? [];
                      return Array.from({ length: colsPerDay }, (_, ci) => {
                        const r = rArr[ci];
                        const val = r?.sensory[row.key as keyof typeof r.sensory];
                        const st  = val ? sensoryStatus(val) : "empty";
                        const sy  = STATUS_STYLE[st];
                        return (
                          <td key={`${di}-${ci}`} title={val ?? ""} style={{ border: CB, padding: "7px 3px", textAlign: "center", background: r ? sy.bg : "white", color: sy.text, fontSize: 11 }}>
                            {val ? <span style={{ fontWeight: 500 }}>{val.slice(0, 6)}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
                          </td>
                        );
                      });
                    })}
                  </tr>
                ))}
              </>
            )}

            {hourlyParams.length > 0 && (
              <ParamGroupRows label={hourlyParams.some(p => p.frequency === "12h") ? "Residual Cl₂ · Per Reading" : "Physical & Chemical"} params={hourlyParams} days={days} dayReadings={dayReadings} colsPerDay={colsPerDay} totalCols={totalCols} bufferPct={bufferPct} cellBorder={CB} onSelectParam={onSelectParam} />
            )}
            {dailyParams.length > 0 && (
              <ParamGroupRows label="Chemical · Daily" params={dailyParams} days={days} dayReadings={dayReadings} colsPerDay={colsPerDay} totalCols={totalCols} bufferPct={bufferPct} cellBorder={CB} onSelectParam={onSelectParam} />
            )}
            {weeklyParams.length > 0 && (
              <ParamGroupRows label="Chemical · Weekly" params={weeklyParams} days={days} dayReadings={dayReadings} colsPerDay={colsPerDay} totalCols={totalCols} bufferPct={bufferPct} cellBorder={CB} onSelectParam={onSelectParam} />
            )}

            {/* Footer */}
            {([
              { label: "Remarks",      field: "remarks"     as const, light: true },
              { label: "QA Executive", field: "qaExecutive" as const, light: false },
              { label: "Team Leader",  field: "teamLeader"  as const, light: false },
            ]).map(({ label, field, light }) => (
              <tr key={label}>
                <td style={{ ...ST1, background: "white", border: CB, padding: "10px 14px", color: "#64748b", fontStyle: "italic", fontSize: 12 }}>{label}</td>
                <td style={{ position: "sticky", left: 200, zIndex: 15, background: "white", border: CB }} />
                <td style={{ position: "sticky", left: 272, zIndex: 15, background: "white", border: CB }} />
                {days.flatMap((dayTs, di) => {
                  const rArr = dayReadings.get(dayTs) ?? [];
                  return Array.from({ length: colsPerDay }, (_, ci) => {
                    const r   = rArr[ci];
                    const val = r ? ((r as any)[field] as string | undefined) : undefined;
                    return (
                      <td key={`${di}-${ci}`} title={val || ""} style={{ border: CB, padding: "10px 6px", textAlign: "center", background: light ? "#fafbfc" : "white", color: "#475569", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

interface PGRProps {
  label: string;
  params: ParamSpec[];
  days: number[];
  dayReadings: Map<number, Reading[]>;
  colsPerDay: number;
  totalCols: number;
  bufferPct: number;
  cellBorder: string;
  onSelectParam?: (key: string) => void;
}

function ParamGroupRows({ label, params, days, dayReadings, colsPerDay, totalCols, bufferPct, cellBorder, onSelectParam }: PGRProps) {
  return (
    <>
      <GroupRow label={label} colSpan={3 + totalCols} />
      {params.map((p) => {
        const isPerEntry = p.frequency === "4h" || p.frequency === "12h";
        const freqLabel  = p.frequency === "4h" ? "Per Entry" : p.frequency === "12h" ? "12h" : p.frequency === "daily" ? "Daily" : "Weekly";
        return (
          <tr key={p.key}>
            <td style={{ position: "sticky", left: 0, zIndex: 15, background: "white", border: cellBorder, padding: 0, fontWeight: 500, color: "#1e293b" }}>
              <ParamLabelCell label={p.label} onClick={onSelectParam ? () => onSelectParam(p.key) : undefined} />
            </td>
            <td style={{ position: "sticky", left: 200, zIndex: 15, background: "white", border: cellBorder, padding: "7px 6px", textAlign: "center", color: "#64748b" }}>{freqLabel}</td>
            <td style={{ position: "sticky", left: 272, zIndex: 15, background: "white", border: cellBorder, padding: "7px 10px", textAlign: "center", color: "#64748b", fontSize: 11 }}>{p.specDisplay}</td>
            {isPerEntry
              ? days.flatMap((dayTs, di) => {
                  const rArr = dayReadings.get(dayTs) ?? [];
                  return Array.from({ length: colsPerDay }, (_, ci) => {
                    const r  = rArr[ci];
                    const v  = r ? (r.values as any)[p.key] as number | undefined : undefined;
                    const st = cellStatus(p, v, bufferPct);
                    const sy = STATUS_STYLE[st];
                    return (
                      <td key={`${di}-${ci}`} title={v !== undefined ? `${v.toFixed(p.decimals)} ${p.unit}` : ""} style={{ border: cellBorder, padding: "7px 3px", textAlign: "center", background: v !== undefined ? sy.bg : "white" }}>
                        {v !== undefined ? <span style={{ fontWeight: 600, fontSize: 11, color: sy.text }}>{fmtValue(p, v)}</span> : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>}
                      </td>
                    );
                  });
                })
              : days.map((dayTs, di) => {
                  const rArr = dayReadings.get(dayTs) ?? [];
                  const r    = rArr.find((row) => (row.values as any)[p.key] !== undefined);
                  const v    = r ? (r.values as any)[p.key] as number | undefined : undefined;
                  const st   = cellStatus(p, v, bufferPct);
                  const sy   = STATUS_STYLE[st];
                  return (
                    <td key={di} colSpan={colsPerDay} title={v !== undefined ? `${v.toFixed(p.decimals)} ${p.unit}` : ""} style={{ border: cellBorder, padding: "7px 6px", textAlign: "center", background: v !== undefined ? sy.bg : "white" }}>
                      {v !== undefined ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sy.dot, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 12, color: sy.text }}>{v.toFixed(p.decimals)} <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.7 }}>{p.unit}</span></span>
                        </div>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                      )}
                    </td>
                  );
                })}
          </tr>
        );
      })}
    </>
  );
}

function GroupRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, background: "#f1f5f9", borderTop: "2px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ position: "sticky", left: 0, padding: "5px 14px", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap", display: "inline-block" }}>
          {label}
        </div>
      </td>
    </tr>
  );
}

function ParamLabelCell({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) return <div style={{ padding: "7px 14px" }}>{label}</div>;
  return (
    <button type="button" onClick={onClick} title="View details" style={{ all: "unset", display: "flex", alignItems: "center", gap: 6, width: "100%", boxSizing: "border-box", padding: "7px 14px", cursor: "pointer", fontWeight: 500, color: "#1e293b", fontSize: 12 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1d4ed8"; const a = e.currentTarget.querySelector("[data-arrow]") as HTMLElement | null; if (a) a.style.opacity = "1"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1e293b"; const a = e.currentTarget.querySelector("[data-arrow]") as HTMLElement | null; if (a) a.style.opacity = "0"; }}
    >
      <span style={{ textDecoration: "underline", textDecorationColor: "#cbd5e1", textUnderlineOffset: 3 }}>{label}</span>
      <span data-arrow style={{ opacity: 0, transition: "opacity 0.12s", fontSize: 11, color: "#1d4ed8" }}>→</span>
    </button>
  );
}
