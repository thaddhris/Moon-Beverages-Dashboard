"use client";

import { useState, useMemo } from "react";
import { ParamSpec, FREQUENCY_HOURS } from "../lib/config";
import { Reading, seriesFor } from "../lib/mockData";
import { Chart } from "./Chart";
import { TimeRange } from "./TimePicker";

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  bufferPct: number;
  timeRange: TimeRange;
  onSelectParam: (key: string) => void;
}

export function TrendsView({ params, readings, bufferPct, timeRange, onSelectParam }: Props) {
  const rangeHours = (timeRange.endTs - timeRange.startTs) / 3600000;
  const [selected, setSelected] = useState<string>(params[0].key);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const spec = params.find((p) => p.key === selected) || params[0];

  const series = useMemo(() => seriesFor(readings, selected as any), [readings, selected]);

  // ── Trend chart with limit bands ──
  const trendOptions: any = {
    chart: { type: "spline", height: 340, zoomType: "x" } as any,
    xAxis: { type: "datetime", crosshair: true },
    yAxis: {
      plotBands: [{ from: spec.min, to: spec.max, color: "rgba(48,209,88,0.05)" }],
      plotLines: [
        { value: spec.min, color: "#ff3b30", dashStyle: "Dash", width: 1, label: { text: `min ${spec.min}`, style: { color: "#ff3b30", fontSize: "10px" }, align: "right", x: -5 } },
        { value: spec.max, color: "#ff3b30", dashStyle: "Dash", width: 1, label: { text: `max ${spec.max}`, style: { color: "#ff3b30", fontSize: "10px" }, align: "right", x: -5 } },
      ],
    },
    tooltip: {
      shared: true,
      formatter: function (this: any) {
        const d = new Date(this.x);
        let html = `<div style="opacity:0.7;font-size:11px;margin-bottom:4px">${d.toUTCString().slice(5, 22)}</div>`;
        this.points.forEach((pt: any) => {
          const pSpec = params.find((x) => x.label === pt.series.name);
          const breach = pSpec && (pt.y < pSpec.min || pt.y > pSpec.max);
          html += `<div style="font-size:12px"><span style="color:${pt.color}">●</span> ${pt.series.name}: <b style="color:${breach ? "#ff453a" : "#fff"}">${pt.y.toFixed(pSpec?.decimals || 2)}</b> ${pSpec?.unit || ""}</div>`;
        });
        return html;
      },
    },
    legend: { enabled: compareKeys.length > 0 },
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
      ...compareKeys.map((k) => {
        const cs = params.find((p) => p.key === k)!;
        return {
          type: "spline" as const,
          name: cs.label,
          data: seriesFor(readings, k as any).map((s) => [s.ts, s.v]),
          dashStyle: "ShortDot" as const,
          opacity: 0.6,
        };
      }),
    ],
  };

  // ── Heatmap: param × day ──
  const dayMs = 24 * 3600 * 1000;
  const days = Math.max(1, Math.ceil(rangeHours / 24));
  const startDay = Math.floor(timeRange.startTs / dayMs);

  const heatmapData: [number, number, number][] = [];
  params.forEach((p, py) => {
    const all = seriesFor(readings, p.key as any);
    for (let dx = 0; dx < days; dx++) {
      const dStart = (startDay + dx) * dayMs;
      const dEnd = dStart + dayMs;
      const inDay = all.filter((r) => r.ts >= dStart && r.ts < dEnd);
      const breaches = inDay.filter((r) => r.v < p.min || r.v > p.max).length;
      heatmapData.push([dx, py, breaches]);
    }
  });

  const heatOptions: any = {
    chart: { type: "heatmap", height: 380, marginTop: 30, marginBottom: 60 },
    xAxis: {
      categories: Array.from({ length: days }, (_, i) => {
        const d = new Date((startDay + i) * dayMs);
        return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
      }),
    },
    yAxis: {
      categories: params.map((p) => p.label),
      reversed: true,
      title: { text: undefined },
    },
    colorAxis: {
      min: 0,
      max: 5,
      stops: [
        [0, "#f0f0f2"],
        [0.01, "#ffe5e3"],
        [1, "#ff3b30"],
      ],
    },
    legend: { enabled: false },
    tooltip: {
      formatter: function (this: any) {
        const p = params[this.point.y];
        return `<b>${p.label}</b><br/>${this.series.xAxis.categories[this.point.x]}<br/><b style="color:${this.point.value > 0 ? "#ff453a" : "#fff"}">${this.point.value} breach${this.point.value === 1 ? "" : "es"}</b>`;
      },
    },
    plotOptions: {
      heatmap: {
        borderColor: "#fff",
        borderWidth: 2,
        cursor: "pointer",
        events: {
          click: function (e: any) {
            const key = params[e.point.y].key;
            setSelected(key);
          },
        },
      },
    } as any,
    series: [{ type: "heatmap", data: heatmapData, name: "Breaches" } as any],
  };

  // ── Adherence bar ──
  const adherence = params.map((p) => {
    const expectedHrs = FREQUENCY_HOURS[p.frequency];
    const expected = Math.max(1, rangeHours / expectedHrs);
    const actual = seriesFor(readings, p.key as any).length;
    return { spec: p, pct: Math.min(100, (actual / expected) * 100), actual, expected: Math.round(expected) };
  }).sort((a, b) => a.pct - b.pct);

  const adhOptions: any = {
    chart: { type: "bar", height: 340 },
    xAxis: { categories: adherence.map((a) => a.spec.label) },
    yAxis: { max: 100, labels: { format: "{value}%" } },
    tooltip: {
      formatter: function (this: any) {
        const a = adherence[this.point.index];
        return `<b>${a.spec.label}</b><br/>${a.actual} / ${a.expected} checks<br/><b>${this.y.toFixed(0)}%</b> adherence`;
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 2,
        cursor: "pointer",
        events: {
          click: function (e: any) {
            setSelected(adherence[e.point.index].spec.key);
          },
        },
      },
    },
    series: [
      {
        type: "bar",
        name: "Adherence",
        data: adherence.map((a) => ({
          y: a.pct,
          color: a.pct < 80 ? "#ff3b30" : a.pct < 95 ? "#ff9f0a" : "#1d1d1f",
        })),
      },
    ],
  };

  // ── Scatter: value vs time of day (shift pattern) ──
  const scatterData = series.map((s) => {
    const d = new Date(s.ts);
    const hod = d.getUTCHours() + d.getUTCMinutes() / 60;
    return { x: hod, y: s.v, shift: s.shift, operator: s.operator, ts: s.ts };
  });

  const scatterOptions: any = {
    chart: { type: "scatter", height: 280 },
    xAxis: { min: 0, max: 24, tickInterval: 4, title: { text: "Hour of day (UTC)", style: { color: "#6e6e73", fontSize: "11px" } } },
    yAxis: {
      plotBands: [{ from: spec.min, to: spec.max, color: "rgba(48,209,88,0.05)" }],
      plotLines: [
        { value: spec.min, color: "#ff3b30", dashStyle: "Dash", width: 1 },
        { value: spec.max, color: "#ff3b30", dashStyle: "Dash", width: 1 },
      ],
    },
    tooltip: {
      formatter: function (this: any) {
        return `<b>${this.point.y.toFixed(spec.decimals)}</b> ${spec.unit}<br/>${new Date(this.point.ts).toUTCString().slice(5, 22)}<br/>Shift ${this.point.shift} · ${this.point.operator}`;
      },
    },
    plotOptions: { scatter: { marker: { radius: 3, symbol: "circle" } } },
    series: [
      {
        type: "scatter",
        name: spec.label,
        data: scatterData.map((d) => ({
          x: d.x,
          y: d.y,
          ts: d.ts,
          shift: d.shift,
          operator: d.operator,
          color: d.y < spec.min || d.y > spec.max ? "#ff3b30" : d.shift === "A" ? "#1d1d1f" : d.shift === "B" ? "#0a84ff" : "#af52de",
        })),
      },
    ] as any,
  };

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6 space-y-4">
      {/* Param selector chip row */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="label">Parameter</div>
            <div className="text-[16px] font-medium mt-0.5">{spec.label}</div>
            <div className="text-[11px] text-[var(--ink-2)]">Limits {spec.min}–{spec.max} {spec.unit} · check every {spec.frequency}</div>
          </div>
          <button
            onClick={() => onSelectParam(spec.key)}
            className="px-3 py-1.5 text-[12px] bg-[var(--bg)] rounded-md hover:bg-[#ebebed]"
          >
            Open detail →
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {params.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                selected === p.key
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-[var(--ink-2)] mr-2">COMPARE:</span>
          {params.filter((p) => p.key !== selected).map((p) => (
            <button
              key={p.key}
              onClick={() =>
                setCompareKeys((c) => (c.includes(p.key) ? c.filter((x) => x !== p.key) : [...c, p.key]))
              }
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                compareKeys.includes(p.key)
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-[var(--hairline)] text-[var(--ink-2)] hover:border-[var(--ink-2)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className="card px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <div className="label">Trend · drag to zoom</div>
        </div>
        <Chart options={trendOptions} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Heatmap */}
        <div className="card px-6 py-5">
          <div className="label mb-2">Breach heatmap · click row to focus</div>
          <Chart options={heatOptions} />
        </div>

        {/* Adherence */}
        <div className="card px-6 py-5">
          <div className="label mb-2">Check adherence</div>
          <Chart options={adhOptions} />
        </div>
      </div>

      {/* Scatter */}
      <div className="card px-6 py-5">
        <div className="label mb-2">{spec.label} by time of day · color = shift</div>
        <Chart options={scatterOptions} />
        <div className="flex gap-4 text-[11px] text-[var(--ink-2)] mt-2">
          <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--ink)] mr-1" />Shift A</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#0a84ff] mr-1" />Shift B</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--stale)] mr-1" />Shift C</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[var(--breach)] mr-1" />Out of range</span>
        </div>
      </div>
    </div>
  );
}
