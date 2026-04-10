"use client";

import { useEffect, useMemo, useState } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, seriesFor, NOW_TS } from "../lib/mockData";
import { Chart } from "./Chart";
import { TimePicker, TimeRange, computePreset } from "./TimePicker";

interface Props {
  paramKey: string | null;
  params: ParamSpec[];
  readings: Reading[];
  onClose: () => void;
}

// Default drawer window: last 7 days ending now
const DEFAULT_DRAWER_RANGE: TimeRange = computePreset("previous7Days", NOW_TS);

export function ParamDetailDrawer({ paramKey, params, readings, onClose }: Props) {
  const [drawerRange, setDrawerRange] = useState<TimeRange>(DEFAULT_DRAWER_RANGE);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  // Reset the drawer's time range each time it opens with a new param
  useEffect(() => {
    if (paramKey) setDrawerRange(DEFAULT_DRAWER_RANGE);
  }, [paramKey]);

  const filtered = useMemo(
    () => readings.filter((r) => r.ts >= drawerRange.startTs && r.ts <= drawerRange.endTs),
    [readings, drawerRange]
  );

  if (!paramKey) return null;
  const spec = params.find((p) => p.key === paramKey);
  if (!spec) return null;

  const series = seriesFor(filtered, spec.key as any);
  const breaches = series.filter((s) => s.v < spec.min || s.v > spec.max).length;
  const minV = series.length ? Math.min(...series.map((s) => s.v)) : 0;
  const maxV = series.length ? Math.max(...series.map((s) => s.v)) : 0;
  const avgV = series.length ? series.reduce((a, b) => a + b.v, 0) / series.length : 0;

  // Main trend chart
  const trendOptions: any = {
    chart: { type: "spline", height: 280 },
    xAxis: { type: "datetime" },
    yAxis: {
      plotBands: [
        { from: spec.min, to: spec.max, color: "rgba(48,209,88,0.06)", label: { text: "Acceptable", style: { color: "#6e6e73", fontSize: "10px" } } },
      ],
      plotLines: [
        { value: spec.min, color: "#ff3b30", dashStyle: "Dash", width: 1 },
        { value: spec.max, color: "#ff3b30", dashStyle: "Dash", width: 1 },
      ],
    },
    tooltip: {
      formatter: function (this: any) {
        const d = new Date(this.x);
        const breach = this.y < spec.min || this.y > spec.max;
        return `<div style="padding:4px"><div style="opacity:0.7;font-size:11px">${d.toUTCString().slice(5, 22)}</div><div style="font-size:14px;font-weight:500;color:${breach ? "#ff453a" : "#fff"}">${this.y.toFixed(spec.decimals)} ${spec.unit}</div>${breach ? '<div style="font-size:10px;color:#ff453a">OUT OF SPECIFICATION</div>' : ""}</div>`;
      },
    },
    series: [
      {
        type: "spline",
        name: spec.label,
        data: series.map((s) => [s.ts, s.v]),
        color: "#1d1d1f",
        zones: [
          { value: spec.min, color: "#ff3b30" },
          { value: spec.max, color: "#1d1d1f" },
          { color: "#ff3b30" },
        ],
      },
    ],
  };

  // Distribution histogram
  const buckets = 12;
  const lo = Math.min(spec.min, minV);
  const hi = Math.max(spec.max, maxV);
  const step = (hi - lo) / buckets || 1;
  const hist = Array(buckets).fill(0);
  series.forEach((s) => {
    const idx = Math.min(buckets - 1, Math.floor((s.v - lo) / step));
    hist[idx]++;
  });

  const distOptions: any = {
    chart: { type: "column", height: 200 },
    xAxis: {
      categories: hist.map((_, i) => (lo + i * step).toFixed(spec.decimals)),
      labels: { rotation: 0 },
    },
    yAxis: { title: { text: undefined } },
    tooltip: {
      formatter: function (this: any) {
        return `<b>${this.y}</b> readings<br/>around ${this.x} ${spec.unit}`;
      },
    },
    plotOptions: { column: { borderRadius: 2, pointPadding: 0.05, groupPadding: 0.05 } },
    series: [
      {
        type: "column",
        name: "Readings",
        data: hist.map((v, i) => {
          const center = lo + (i + 0.5) * step;
          const inRange = center >= spec.min && center <= spec.max;
          return { y: v, color: inRange ? "#1d1d1f" : "#ff3b30" };
        }),
      },
    ],
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[780px] bg-[var(--surface)] shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-8 py-5 border-b border-[var(--hairline)] gap-4">
          <div className="flex-shrink-0">
            <div className="label">Parameter detail</div>
            <div className="text-[22px] font-medium mt-0.5">{spec.label}</div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <TimePicker value={drawerRange} onChange={setDrawerRange} />
            <button
              onClick={onClose}
              className="text-[var(--ink-2)] hover:text-[var(--ink)] text-2xl leading-none px-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Stat tiles */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Acceptable" value={`${spec.min}–${spec.max}`} unit={spec.unit} />
            <Stat label="Average" value={avgV.toFixed(spec.decimals)} unit={spec.unit} />
            <Stat label="Min · Max" value={`${minV.toFixed(spec.decimals)} · ${maxV.toFixed(spec.decimals)}`} unit={spec.unit} />
            <Stat label="Out of Specification" value={String(breaches)} unit="" tone={breaches > 0 ? "breach" : undefined} />
          </div>

          <div>
            <div className="label mb-2">Trend · {drawerRange.label}</div>
            <Chart options={trendOptions} />
          </div>

          <div>
            <div className="label mb-2">Distribution</div>
            <Chart options={distOptions} />
          </div>

          <div>
            <div className="label mb-2">Recent readings</div>
            <div className="border border-[var(--hairline)] rounded-lg overflow-hidden">
              <table className="w-full text-[12px] tnum">
                <thead className="bg-[var(--bg)] text-[var(--ink-2)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal">Time</th>
                    <th className="text-left px-3 py-2 font-normal">Value</th>
                    <th className="text-left px-3 py-2 font-normal">Operator</th>
                    <th className="text-left px-3 py-2 font-normal">Shift</th>
                    <th className="text-left px-3 py-2 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {series.slice(-12).reverse().map((s, i) => {
                    const breach = s.v < spec.min || s.v > spec.max;
                    return (
                      <tr key={i} className="border-t border-[var(--hairline)]">
                        <td className="px-3 py-2">{new Date(s.ts).toUTCString().slice(5, 22)}</td>
                        <td className="px-3 py-2" style={{ color: breach ? "var(--breach)" : undefined }}>
                          {s.v.toFixed(spec.decimals)} {spec.unit}
                        </td>
                        <td className="px-3 py-2">{s.operator}</td>
                        <td className="px-3 py-2">{s.shift}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: breach ? "var(--breach)" : "var(--ok)" }}
                            />
                            {breach ? "Out of Specification" : "In Control"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: "breach" }) {
  return (
    <div className="card px-4 py-3">
      <div className="label text-[10px]">{label}</div>
      <div className="text-[18px] font-medium tnum mt-1" style={{ color: tone === "breach" ? "var(--breach)" : undefined }}>
        {value}
      </div>
      {unit && <div className="text-[10px] text-[var(--ink-2)]">{unit}</div>}
    </div>
  );
}
