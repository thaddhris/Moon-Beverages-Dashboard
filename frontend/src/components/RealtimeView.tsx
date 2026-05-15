"use client";

import { ParamSpec } from "../lib/config";
import { Reading, latestPerParam, seriesFor, NOW_TS } from "../lib/mockData";
import { statusFor, statusColor, isDrifting } from "../lib/status";
import { Chart } from "./Chart";
import { TimeRange } from "./TimePicker";
import { submissionStatsForRange } from "../lib/slots";

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  range: TimeRange;
  bufferPct: number;
  driftWindow: number;
  driftProject: number;
  onSelectParam: (key: string) => void;
  waterLabel?: string;
}

const CAT_ACCENTS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

function timeAgo(ts: number): string {
  const mins = Math.floor((NOW_TS - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ParamCardProps {
  p: ParamSpec;
  readings: Reading[];
  range: TimeRange;
  bufferPct: number;
  drifting: boolean;
  onSelectParam: (key: string) => void;
}

function ParamCard({ p, readings, range, bufferPct, drifting, onSelectParam }: ParamCardProps) {
  const latest = latestPerParam(readings);
  const l = latest[p.key];
  const status = statusFor(l?.value, p, bufferPct);
  const fullSeries = seriesFor(readings, p.key as any);
  const avg = fullSeries.length ? fullSeries.reduce((s, d) => s + d.v, 0) / fullSeries.length : null;
  const color = statusColor(status);

  const seriesMin = fullSeries.length ? Math.min(...fullSeries.map((s) => s.v)) : p.min;
  const seriesMax = fullSeries.length ? Math.max(...fullSeries.map((s) => s.v)) : p.max;
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
      labels: { style: { color: "#94a3b8", fontSize: "9px" }, y: 12, format: "{value:%d %b}" },
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
        formatter: function (this: any) { return Number(this.value).toFixed(p.decimals); },
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
    series: [{ type: "areaspline", data: fullSeries.map((s) => [s.ts, s.v]), color }],
  };

  return (
    <button key={p.key} onClick={() => onSelectParam(p.key)} className="card px-4 py-4 text-left group">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] text-[var(--ink-2)]">{p.label}</div>
        {status === "breach" && <span className="text-[11px] text-[var(--breach)]">Out of Specification</span>}
        {status !== "breach" && drifting && (
          <span className="text-[11px] text-[var(--warn)]" title="Approaching spec limit">At Risk</span>
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
}

export function RealtimeView({
  params,
  readings,
  range,
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
  const heroLabel = counts.breach > 0 ? "Out of Specification" : counts.warn > 0 ? "At Risk" : "In Control";

  const submissions = submissionStatsForRange(readings, range.startTs, range.endTs);

  // Category grouping
  const hasCategories = params.some((p) => p.category);
  const orderedCategories: string[] = [];
  const seenCats = new Set<string>();
  for (const p of params) {
    if (p.category && !seenCats.has(p.category)) { seenCats.add(p.category); orderedCategories.push(p.category); }
  }
  const paramsByCategory = new Map<string, ParamSpec[]>();
  for (const p of params) {
    const k = p.category ?? "__none__";
    if (!paramsByCategory.has(k)) paramsByCategory.set(k, []);
    paramsByCategory.get(k)!.push(p);
  }

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
          <SubmissionChip label="Filled"        value={`${submissions.filled}/${submissions.expected}`} accent="var(--ok)"    active={submissions.filled > 0} />
          <SubmissionChip label="Missed Slots"  value={String(submissions.missed)}                      accent="var(--breach)" active={submissions.missed > 0} />
          <SubmissionChip label="Multiple"      value={String(submissions.multi)}                       accent="#3b82f6"       active={submissions.multi > 0} tooltip="Slots with more than one submission" />
          <SubmissionChip label="Total Entries" value={String(submissions.totalSubmissions)}             accent="var(--ink-2)"  active={false} />
        </div>
      </div>

      {/* Section caption */}
      <div className="mb-3 text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">
        {waterLabel ? `${waterLabel} · ` : ""}Parameters · {range.label}
      </div>

      {/* Parameter grid */}
      <div className="grid grid-cols-4 gap-3">
        {hasCategories ? (
          orderedCategories.flatMap((cat, catIdx) => {
            const accent = CAT_ACCENTS[catIdx % CAT_ACCENTS.length];
            const catParams = paramsByCategory.get(cat) ?? [];
            return [
              // Full-width category label
              <div
                key={`cat-label-${cat}`}
                className="col-span-4 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${accent} 8%, white)`,
                  border: `1px solid color-mix(in srgb, ${accent} 25%, white)`,
                  borderLeft: `3px solid ${accent}`,
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: accent }}>{cat}</span>
                <span className="text-[10px] text-[var(--ink-2)]">
                  {catParams[0]?.frequency === "4h" ? "· every 4 hours" : catParams[0]?.frequency === "weekly" ? "· weekly" : "· daily"}
                </span>
              </div>,
              ...catParams.map((p) => (
                <ParamCard
                  key={p.key}
                  p={p}
                  readings={readings}
                  range={range}
                  bufferPct={bufferPct}
                  drifting={driftingKeys.has(p.key)}
                  onSelectParam={onSelectParam}
                />
              )),
            ];
          })
        ) : (
          <>
            {params.map((p) => (
              <ParamCard
                key={p.key}
                p={p}
                readings={readings}
                range={range}
                bufferPct={bufferPct}
                drifting={driftingKeys.has(p.key)}
                onSelectParam={onSelectParam}
              />
            ))}
            <div className="card px-4 py-4">
              <div className="text-[12px] text-[var(--ink-2)] mb-2">Sensory</div>
              <div className="text-[20px] font-medium leading-none mb-2">Normal</div>
              <div className="text-[11px] text-[var(--ink-2)]">Appearance · Odor · Taste</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SubmissionChip({ label, value, accent, active, tooltip }: { label: string; value: string; accent: string; active: boolean; tooltip?: string }) {
  return (
    <div title={tooltip} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 6, fontSize: 12, background: active ? `color-mix(in srgb, ${accent} 10%, white)` : "#f5f5f7", border: `1px solid ${active ? `color-mix(in srgb, ${accent} 30%, white)` : "var(--hairline)"}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? accent : "#cbd5e1" }} />
      <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: active ? accent : "var(--ink-2)" }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{label}</span>
    </div>
  );
}

function Counter({ label, value, accent, active }: { label: string; value: number; accent: string; active: boolean }) {
  const textColor = active ? accent : "var(--ink-2)";
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg" style={{ background: active ? `color-mix(in srgb, ${accent} 8%, white)` : "#f5f5f7", border: `1px solid ${active ? `color-mix(in srgb, ${accent} 25%, white)` : "var(--hairline)"}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? accent : "#cbd5e1" }} />
      <span className="text-[18px] tnum leading-none font-medium" style={{ color: textColor }}>{value}</span>
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: active ? textColor : "var(--ink-2)" }}>{label}</span>
    </div>
  );
}
