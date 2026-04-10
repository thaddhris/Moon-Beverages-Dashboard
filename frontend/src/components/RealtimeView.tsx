"use client";

import { ParamSpec } from "../lib/config";
import { Reading, latestPerParam, seriesFor, NOW_TS } from "../lib/mockData";
import { statusFor, statusColor, isDrifting } from "../lib/status";
import { Chart } from "./Chart";

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  bufferPct: number;
  driftWindow: number;
  driftProject: number;
  onSelectParam: (key: string) => void;
}

function timeAgo(ts: number): string {
  const mins = Math.floor((NOW_TS - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RealtimeView({ params, readings, bufferPct, driftWindow, driftProject, onSelectParam }: Props) {
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
  // Beverage QC terminology (project-wide)
  const heroLabel =
    counts.breach > 0 ? "Out of Specification" : counts.warn > 0 ? "At Risk" : "In Control";

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
        <div className="flex items-center gap-10 text-[13px] tnum">
          <Counter label="Out of Specification" value={counts.breach} color={counts.breach > 0 ? "var(--breach)" : "var(--ink-2)"} />
          <Counter label="At Risk" value={counts.warn} color={counts.warn > 0 ? "var(--warn)" : "var(--ink-2)"} />
          <Counter label="In Control" value={counts.ok} color="var(--ink-2)" />
        </div>
      </div>

      {/* Parameter grid */}
      <div className="grid grid-cols-4 gap-3">
        {params.map((p) => {
          const l = latest[p.key];
          const status = statusFor(l?.value, p, bufferPct);
          const fullSeries = seriesFor(readings, p.key as any);
          const series = fullSeries.slice(-20);
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
              lineColor: "#e2e8f0",
              tickColor: "#e2e8f0",
              tickLength: 3,
              labels: {
                style: { color: "#94a3b8", fontSize: "9px" },
                y: 12,
                format: "{value:%d %b}",
              },
              tickPositioner: function (this: any) {
                const ext = this.getExtremes();
                return [ext.dataMin, ext.dataMax];
              },
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

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-[22px] mt-1 tnum" style={{ color }}>{value}</div>
    </div>
  );
}
