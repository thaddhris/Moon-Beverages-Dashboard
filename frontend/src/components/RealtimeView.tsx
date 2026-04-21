"use client";

import { useEffect, useRef, useState } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, latestPerParam, seriesFor, NOW_TS } from "../lib/mockData";
import { statusFor, statusColor, isDrifting } from "../lib/status";
import { Chart } from "./Chart";
import { TimeRange, computePreset } from "./TimePicker";
import { submissionStatsForRange } from "../lib/slots";

type OverviewPresetKey =
  | "today"
  | "yesterday"
  | "currentWeek"
  | "previousWeek"
  | "currentMonth"
  | "previousMonth";

const OVERVIEW_PRESETS: { key: OverviewPresetKey; label: string }[] = [
  { key: "today",         label: "Today" },
  { key: "yesterday",     label: "Yesterday" },
  { key: "currentWeek",   label: "This Week" },
  { key: "previousWeek",  label: "Previous Week" },
  { key: "currentMonth",  label: "This Month" },
  { key: "previousMonth", label: "Previous Month" },
];

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  bufferPct: number;
  driftWindow: number;
  driftProject: number;
  onSelectParam: (key: string) => void;
  waterLabel?: string;
}

function timeAgo(ts: number): string {
  const mins = Math.floor((NOW_TS - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RealtimeView({
  params,
  readings,
  range,
  onRangeChange,
  bufferPct,
  driftWindow,
  driftProject,
  onSelectParam,
  waterLabel,
}: Props) {
  const latest = latestPerParam(readings);

  const counts = { ok: 0, warn: 0, breach: 0, stale: 0 };
  const driftingKeys = new Set<string>();

  for (const p of params) {
    const s = statusFor(latest[p.key]?.value, p, bufferPct);
    counts[s]++;
    const seriesVals = seriesFor(readings, p.key as any).slice(-driftWindow).map((d) => d.v);
    if (s === "ok" && isDrifting(seriesVals, p, driftProject)) {
      driftingKeys.add(p.key);
      counts.warn++;
      counts.ok--;
    }
  }

  const lastTs = Object.values(latest).reduce((m, l) => Math.max(m, l!.ts), 0);
  const heroColor = counts.breach > 0 ? "var(--breach)" : counts.warn > 0 ? "var(--warn)" : "var(--ok)";
  const heroLabel =
    counts.breach > 0 ? "Out of Specification" : counts.warn > 0 ? "At Risk" : "In Control";

  // Slot / submission stats for the selected period
  const submissions = submissionStatsForRange(readings, range.startTs, range.endTs);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      {/* Quality status hero */}
      <div className="card px-6 py-5 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="w-3 h-3 rounded-full" style={{ background: heroColor }} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium">Quality Status</div>
            <div className="text-[26px] font-medium tracking-tight mt-0.5" style={{ color: heroColor }}>{heroLabel}</div>
            <div className="text-[12px] text-[var(--ink-2)] mt-0.5">Last sample {timeAgo(lastTs)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Counter label="Out of Specification" value={counts.breach} accent="var(--breach)" active={counts.breach > 0} />
          <Counter label="At Risk"              value={counts.warn}   accent="var(--warn)"   active={counts.warn > 0} />
          <Counter label="In Control"           value={counts.ok}     accent="var(--ok)"     active={counts.ok > 0} />
        </div>
      </div>

      {/* Submission stats */}
      <div className="card px-5 py-3 mb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium mr-1">
            Form Submissions
          </div>
          <SubmissionChip
            label="Filled"
            value={`${submissions.filled}/${submissions.expected}`}
            accent="var(--ok)"
            active={submissions.filled > 0}
          />
          <SubmissionChip
            label="Missed Slots"
            value={String(submissions.missed)}
            accent="var(--breach)"
            active={submissions.missed > 0}
          />
          <SubmissionChip
            label="Multiple"
            value={String(submissions.multi)}
            accent="#3b82f6"
            active={submissions.multi > 0}
            tooltip="Slots with more than one submission"
          />
          <SubmissionChip
            label="Total Entries"
            value={String(submissions.totalSubmissions)}
            accent="var(--ink-2)"
            active={false}
          />
        </div>
        <div className="text-[11px] text-[var(--ink-2)]">
          6 expected slots per day · 00–04 · 04–08 · 08–12 · 12–16 · 16–20 · 20–24
        </div>
      </div>

      {/* Periodicity selector */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">
          {waterLabel ? `${waterLabel} · ` : ""}Parameters · {range.label}
        </div>
        <PeriodicityDropdown
          current={range.label}
          onSelect={(key) => onRangeChange(computePreset(key, NOW_TS))}
        />
      </div>

      {/* Parameter grid */}
      <div className="grid grid-cols-4 gap-3">
        {params.map((p) => {
          const l = latest[p.key];
          const status = statusFor(l?.value, p, bufferPct);
          const fullSeries = seriesFor(readings, p.key as any);
          // `readings` is already filtered to the selected range in page.tsx
          const series = fullSeries;
          const avg = fullSeries.length
            ? fullSeries.reduce((s, d) => s + d.v, 0) / fullSeries.length
            : null;
          const drifting = driftingKeys.has(p.key);
          const color = statusColor(status);

          const seriesMin = series.length ? Math.min(...series.map((s) => s.v)) : p.min;
          const seriesMax = series.length ? Math.max(...series.map((s) => s.v)) : p.max;
          const yMin = Math.min(p.min, seriesMin);
          const yMax = Math.max(p.max, seriesMax);

          const sparkOptions: any = {
            chart: { type: "areaspline", height: 74, margin: [4, 6, 18, 30], backgroundColor: "transparent" },
            credits: { enabled: false },
            title: { text: undefined },
            legend: { enabled: false },
            xAxis: {
              type: "datetime",
              min: range.startTs,
              max: range.endTs,
              lineColor: "#e2e8f0",
              tickColor: "#e2e8f0",
              tickLength: 3,
              labels: {
                style: { color: "#94a3b8", fontSize: "9px" },
                y: 12,
                format: "{value:%d %b}",
              },
              tickPositions: [range.startTs, range.endTs],
            },
            yAxis: {
              min: yMin,
              max: yMax,
              gridLineWidth: 0,
              lineWidth: 0,
              tickWidth: 0,
              title: { text: undefined },
              labels: {
                style: { color: "#94a3b8", fontSize: "9px" },
                x: -3,
                formatter: function (this: any) {
                  return Number(this.value).toFixed(p.decimals);
                },
              },
              tickPositions: [yMin, yMax],
              plotBands: [{ from: p.min, to: p.max, color: "rgba(29,29,31,0.04)" }],
            },
            tooltip: {
              formatter: function (this: any) {
                return `<b>${this.y.toFixed(p.decimals)}</b> ${p.unit}<br/><span style="opacity:0.6">${new Date(this.x).toUTCString().slice(5, 22)}</span>`;
              },
            },
            plotOptions: {
              areaspline: {
                fillOpacity: 0.08,
                lineWidth: 1.5,
                marker: { enabled: false },
                states: { hover: { lineWidth: 1.5 } },
              },
            },
            series: [{ type: "areaspline", data: series.map((s) => [s.ts, s.v]), color }],
          };

          return (
            <button
              key={p.key}
              onClick={() => onSelectParam(p.key)}
              className="card px-4 py-4 text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] text-[var(--ink-2)]">{p.label}</div>
                {status === "breach" && (
                  <span className="text-[11px] text-[var(--breach)]">Out of Specification</span>
                )}
                {status !== "breach" && drifting && (
                  <span className="text-[11px] text-[var(--warn)]" title="Approaching spec limit">
                    At Risk
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <div className="text-[26px] font-medium tnum leading-none" style={{ color }}>
                  {avg !== null ? avg.toFixed(p.decimals) : "—"}
                </div>
                <div className="text-[11px] text-[var(--ink-2)]">{p.unit}</div>
              </div>
              <div className="text-[10px] text-[var(--ink-2)] mb-1">
                Avg · n={fullSeries.length} · Range {p.min}–{p.max}
              </div>
              <Chart options={sparkOptions} />
              <div className="text-[10px] text-[var(--ink-2)] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Click for detail →
              </div>
            </button>
          );
        })}
        <div className="card px-4 py-4">
          <div className="text-[12px] text-[var(--ink-2)] mb-2">Sensory</div>
          <div className="text-[20px] font-medium leading-none mb-2">Normal</div>
          <div className="text-[11px] text-[var(--ink-2)]">Appearance · Odor · Taste</div>
        </div>
      </div>
    </div>
  );
}

function SubmissionChip({
  label,
  value,
  accent,
  active,
  tooltip,
}: {
  label: string;
  value: string;
  accent: string;
  active: boolean;
  tooltip?: string;
}) {
  return (
    <div
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 10px",
        borderRadius: 6,
        fontSize: 12,
        background: active ? `color-mix(in srgb, ${accent} 10%, white)` : "#f5f5f7",
        border: `1px solid ${active ? `color-mix(in srgb, ${accent} 30%, white)` : "var(--hairline)"}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? accent : "#cbd5e1",
        }}
      />
      <span
        className="tnum"
        style={{ fontSize: 13, fontWeight: 600, color: active ? accent : "var(--ink-2)" }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{label}</span>
    </div>
  );
}

function PeriodicityDropdown({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (key: OverviewPresetKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          color: "#0f172a",
          height: 32,
          minWidth: 160,
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span style={{ fontWeight: 500 }}>{current}</span>
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15,23,42,0.1), 0 2px 6px rgba(15,23,42,0.05)",
            zIndex: 40,
            minWidth: 180,
            padding: 4,
          }}
        >
          {OVERVIEW_PRESETS.map((p) => {
            const active = p.label === current;
            return (
              <button
                key={p.key}
                onClick={() => {
                  onSelect(p.key);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  textAlign: "left",
                  background: active ? "#e0f2fe" : "transparent",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  color: active ? "#0369a1" : "#334155",
                  fontWeight: active ? 600 : 400,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "#f1f5f9";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  accent,
  active,
}: {
  label: string;
  value: number;
  accent: string;
  active: boolean;
}) {
  const textColor = active ? accent : "var(--ink-2)";
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg"
      style={{
        background: active ? `color-mix(in srgb, ${accent} 8%, white)` : "#f5f5f7",
        border: `1px solid ${active ? `color-mix(in srgb, ${accent} 25%, white)` : "var(--hairline)"}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? accent : "#cbd5e1" }}
      />
      <span
        className="text-[18px] tnum leading-none font-medium"
        style={{ color: textColor }}
      >
        {value}
      </span>
      <span
        className="text-[11px] font-medium whitespace-nowrap"
        style={{ color: active ? textColor : "var(--ink-2)" }}
      >
        {label}
      </span>
    </div>
  );
}
