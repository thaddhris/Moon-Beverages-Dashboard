"use client";

import { useState, useRef, useEffect } from "react";
import { NOW_TS } from "../lib/mockData";

const HOUR = 3600000;
const DAY = 24 * HOUR;

export interface TimeRange {
  label: string;
  startTs: number;
  endTs: number;
}

/* ──────────────────────────────────────────────────────────────
   Preset definitions
   ────────────────────────────────────────────────────────────── */

const PRESETS_DEF = [
  { key: "custom",           label: "Custom" },
  { key: "today",            label: "Today" },
  { key: "yesterday",        label: "Yesterday" },
  { key: "currentWeek",      label: "Current Week" },
  { key: "previousWeek",     label: "Previous Week" },
  { key: "previous7Days",    label: "Previous 7 Days" },
  { key: "currentMonth",     label: "Current Month" },
  { key: "previousMonth",    label: "Previous Month" },
  { key: "previous3Months",  label: "Previous 3 Months" },
  { key: "previous12Months", label: "Previous 12 Months" },
  { key: "currentYear",      label: "Current Year" },
  { key: "previousYear",     label: "Previous Year" },
] as const;

type PresetKey = typeof PRESETS_DEF[number]["key"];

/* ──────────────────────────────────────────────────────────────
   Date helpers (all UTC)
   ────────────────────────────────────────────────────────────── */

function startOfUtcDay(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function endOfUtcDay(ts: number): number { return startOfUtcDay(ts) + DAY - 60000; }
function startOfUtcWeek(ts: number): number {
  const d = new Date(startOfUtcDay(ts));
  return d.getTime() - d.getUTCDay() * DAY; // Sunday as week start
}
function startOfUtcMonth(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function endOfUtcMonth(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 60000;
}
function startOfUtcYear(ts: number): number {
  return Date.UTC(new Date(ts).getUTCFullYear(), 0, 1);
}

export function computePreset(key: PresetKey, now: number): TimeRange {
  const label = PRESETS_DEF.find((p) => p.key === key)!.label;
  switch (key) {
    case "today":
      return { label, startTs: startOfUtcDay(now), endTs: endOfUtcDay(now) };
    case "yesterday": {
      const y = now - DAY;
      return { label, startTs: startOfUtcDay(y), endTs: endOfUtcDay(y) };
    }
    case "currentWeek": {
      // Sunday of the current week → today (never into the future)
      const s = startOfUtcWeek(now);
      return { label, startTs: s, endTs: endOfUtcDay(now) };
    }
    case "previousWeek": {
      const s = startOfUtcWeek(now) - 7 * DAY;
      return { label, startTs: s, endTs: endOfUtcDay(s + 6 * DAY) };
    }
    case "previous7Days":
      return { label, startTs: startOfUtcDay(now - 7 * DAY), endTs: endOfUtcDay(now) };
    case "currentMonth":
      // 1st of the month → today (never into the future)
      return { label, startTs: startOfUtcMonth(now), endTs: endOfUtcDay(now) };
    case "previousMonth": {
      const d = new Date(now);
      return {
        label,
        startTs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1),
        endTs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 60000,
      };
    }
    case "previous3Months": {
      const d = new Date(now);
      const s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 3, d.getUTCDate());
      return { label, startTs: startOfUtcDay(s), endTs: endOfUtcDay(now) };
    }
    case "previous12Months": {
      const d = new Date(now);
      const s = Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate());
      return { label, startTs: startOfUtcDay(s), endTs: endOfUtcDay(now) };
    }
    case "currentYear": {
      // Jan 1 → today (never into the future)
      const y = new Date(now).getUTCFullYear();
      return { label, startTs: Date.UTC(y, 0, 1), endTs: endOfUtcDay(now) };
    }
    case "previousYear": {
      const y = new Date(now).getUTCFullYear() - 1;
      return { label, startTs: Date.UTC(y, 0, 1), endTs: Date.UTC(y + 1, 0, 1) - 60000 };
    }
    case "custom":
      return { label: "Custom", startTs: startOfUtcDay(now - 7 * DAY), endTs: endOfUtcDay(now) };
  }
}

export const DEFAULT_RANGE: TimeRange = computePreset("previous7Days", NOW_TS);

/* ──────────────────────────────────────────────────────────────
   Formatters
   ────────────────────────────────────────────────────────────── */

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_UPPER = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtDateSlash(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
function fmtDateShort(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getUTCDate())} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
function parseTime(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]);
  const mm = parseInt(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * HOUR + mm * 60000;
}

/* ──────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────── */

interface Props {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}

export function TimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => {
    const p = PRESETS_DEF.find((pd) => pd.label === value.label);
    return (p?.key ?? "custom") as PresetKey;
  });
  const [draftStart, setDraftStart] = useState(value.startTs);
  const [draftEnd, setDraftEnd] = useState(value.endTs);
  const [startTimeStr, setStartTimeStr] = useState(fmtTime(value.startTs));
  const [endTimeStr, setEndTimeStr] = useState(fmtTime(value.endTs));
  const [calMonth, setCalMonth] = useState(() => startOfUtcMonth(value.startTs));
  const [pickState, setPickState] = useState<"start" | "end">("start");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) {
      setDraftStart(value.startTs);
      setDraftEnd(value.endTs);
      setStartTimeStr(fmtTime(value.startTs));
      setEndTimeStr(fmtTime(value.endTs));
      setCalMonth(startOfUtcMonth(value.startTs));
      const p = PRESETS_DEF.find((pd) => pd.label === value.label);
      setActivePreset((p?.key ?? "custom") as PresetKey);
      setPickState("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function selectPreset(key: PresetKey) {
    setActivePreset(key);
    if (key === "custom") return;
    const r = computePreset(key, NOW_TS);
    setDraftStart(r.startTs);
    setDraftEnd(r.endTs);
    setStartTimeStr(fmtTime(r.startTs));
    setEndTimeStr(fmtTime(r.endTs));
    setCalMonth(startOfUtcMonth(r.startTs));
    setPickState("start");
  }

  function handleDayClick(dayTs: number) {
    setActivePreset("custom");
    const sTime = parseTime(startTimeStr) ?? 0;
    const eTime = parseTime(endTimeStr) ?? DAY - 60000;
    if (pickState === "start") {
      setDraftStart(dayTs + sTime);
      setDraftEnd(dayTs + eTime); // temporary same-day end
      setPickState("end");
    } else {
      if (dayTs < startOfUtcDay(draftStart)) {
        // clicked earlier than current start → restart
        setDraftStart(dayTs + sTime);
        setDraftEnd(dayTs + eTime);
        setPickState("end");
      } else {
        setDraftEnd(dayTs + eTime);
        setPickState("start");
      }
    }
  }

  function changeMonth(delta: number) {
    const d = new Date(calMonth);
    setCalMonth(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
  }

  function handleApply() {
    const sT = parseTime(startTimeStr);
    const eT = parseTime(endTimeStr);
    let start = draftStart;
    let end = draftEnd;
    if (sT !== null) start = startOfUtcDay(draftStart) + sT;
    if (eT !== null) end = startOfUtcDay(draftEnd) + eT;
    if (start > end) [start, end] = [end, start];
    const label =
      activePreset === "custom"
        ? "Custom"
        : PRESETS_DEF.find((p) => p.key === activePreset)?.label ?? "Custom";
    onChange({ label, startTs: start, endTs: end });
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <TriggerButton value={value} onClick={() => setOpen(!open)} />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 12px 40px rgba(15,23,42,0.14), 0 2px 10px rgba(15,23,42,0.05)",
            display: "flex",
            overflow: "hidden",
            zIndex: 50,
            width: 720,
            fontFamily: "inherit",
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              width: 176,
              background: "#fafbfc",
              borderRight: "1px solid #e2e8f0",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {PRESETS_DEF.map((p) => {
              const active = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => selectPreset(p.key)}
                  style={{
                    padding: "8px 14px",
                    textAlign: "left",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "inherit",
                    background: active ? "#e0f2fe" : "transparent",
                    color: active ? "#0369a1" : "#334155",
                    fontWeight: active ? 600 : 400,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f1f5f9"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Main panel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Date/time inputs */}
            <div
              style={{
                padding: "22px 24px 14px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <LabeledInput label="Start Date" value={fmtDateSlash(draftStart)} readOnly />
              <LabeledInput
                label="Start Time"
                value={startTimeStr}
                onChange={setStartTimeStr}
                placeholder="00:00"
              />
              <LabeledInput label="End Date" value={fmtDateSlash(draftEnd)} readOnly />
              <LabeledInput
                label="End Time"
                value={endTimeStr}
                onChange={setEndTimeStr}
                placeholder="23:59"
              />
            </div>

            {/* Calendar */}
            <div style={{ padding: "4px 24px 16px", flex: 1 }}>
              <Calendar
                month={calMonth}
                startDate={draftStart}
                endDate={draftEnd}
                onMonthDelta={changeMonth}
                onDayClick={handleDayClick}
              />
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "1px solid #e2e8f0",
                padding: "12px 20px",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "#fafbfc",
              }}
            >
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "7px 16px",
                  background: "transparent",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#475569",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                style={{
                  padding: "7px 22px",
                  background: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "inherit",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────── */

function TriggerButton({ value, onClick }: { value: TimeRange; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        height: 34,
      }}
    >
      <span style={{ color: "#64748b", fontWeight: 500 }}>Duration :</span>
      <span
        style={{
          background: "#0f172a",
          color: "white",
          padding: "4px 12px",
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {value.label}
      </span>
      <span style={{ color: "#0f172a", fontVariantNumeric: "tabular-nums", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
        {fmtDateShort(value.startTs)}
        <span style={{ color: "#10b981" }}>·</span>
        {fmtDateShort(value.endTs)}
      </span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </button>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        border: "1.5px solid #cbd5e1",
        borderRadius: 6,
        padding: "9px 12px",
        background: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -8,
          left: 10,
          fontSize: 11,
          background: "white",
          padding: "0 5px",
          color: "#10b981",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        {label} <span style={{ color: "#ef4444" }}>*</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          border: "none",
          outline: "none",
          width: "100%",
          fontSize: 13,
          background: "transparent",
          fontFamily: "inherit",
          color: "#0f172a",
          cursor: readOnly ? "default" : "text",
          fontVariantNumeric: "tabular-nums",
        }}
      />
    </div>
  );
}

function Calendar({
  month,
  startDate,
  endDate,
  onMonthDelta,
  onDayClick,
}: {
  month: number;
  startDate: number;
  endDate: number;
  onMonthDelta: (d: number) => void;
  onDayClick: (dayTs: number) => void;
}) {
  const d = new Date(month);
  const year = d.getUTCFullYear();
  const mIdx = d.getUTCMonth();
  const firstDayOfWeek = new Date(Date.UTC(year, mIdx, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, mIdx + 1, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, mIdx, 0)).getUTCDate();

  // Build 42 cells (6 weeks × 7 days)
  const cells: { ts: number; inMonth: boolean }[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ ts: Date.UTC(year, mIdx - 1, prevMonthDays - i), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ ts: Date.UTC(year, mIdx, day), inMonth: true });
  }
  while (cells.length < 42) {
    const lastTs = cells[cells.length - 1].ts;
    cells.push({ ts: lastTs + DAY, inMonth: false });
  }

  const startDay = startOfUtcDay(startDate);
  const endDay = startOfUtcDay(endDate);
  const today = startOfUtcDay(NOW_TS);

  const navBtn: React.CSSProperties = {
    width: 26,
    height: 26,
    border: "1px solid #e2e8f0",
    background: "white",
    borderRadius: 5,
    cursor: "pointer",
    color: "#475569",
    fontSize: 15,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", letterSpacing: "0.05em" }}>
          {MONTH_UPPER[mIdx]} {year}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => onMonthDelta(-1)} style={navBtn} aria-label="Previous month">‹</button>
          <button onClick={() => onMonthDelta(1)} style={navBtn} aria-label="Next month">›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 2 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              color: "#94a3b8",
              padding: "6px 0 10px",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
        {cells.map(({ ts, inMonth }, i) => {
          const isStart = ts === startDay;
          const isEnd = ts === endDay;
          const isEndpoint = isStart || isEnd;
          const inRange = ts > startDay && ts < endDay;
          const isToday = ts === today;

          let wrapperBg = "transparent";
          if (inRange) wrapperBg = "#f1f5f9";
          if (isStart && endDay > startDay) wrapperBg = "linear-gradient(to right, transparent 50%, #f1f5f9 50%)";
          if (isEnd && endDay > startDay) wrapperBg = "linear-gradient(to right, #f1f5f9 50%, transparent 50%)";
          if (isStart && isEnd) wrapperBg = "transparent";

          return (
            <div
              key={i}
              style={{
                position: "relative",
                background: wrapperBg,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => onDayClick(ts)}
                style={{
                  position: "relative",
                  width: 32,
                  height: 32,
                  border: isToday && !isEndpoint ? "1.5px solid #0f172a" : "none",
                  borderRadius: "50%",
                  background: isEndpoint ? "#0f172a" : "transparent",
                  color: isEndpoint ? "white" : inMonth ? "#0f172a" : "#cbd5e1",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: isEndpoint ? 600 : isToday ? 600 : 400,
                  fontVariantNumeric: "tabular-nums",
                  transition: "background 0.12s, color 0.12s",
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isEndpoint) (e.currentTarget as HTMLElement).style.background = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  if (!isEndpoint) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {new Date(ts).getUTCDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
