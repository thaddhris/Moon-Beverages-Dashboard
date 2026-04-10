"use client";

import { ParamSpec } from "../lib/config";
import { Reading, seriesFor } from "../lib/mockData";
import { Chart } from "./Chart";
import { TimeRange } from "./TimePicker";

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  timeRange: TimeRange;
  onSelectParam: (key: string) => void;
}

export function SummaryView({ params, readings, timeRange, onSelectParam }: Props) {
  const rangeHours = (timeRange.endTs - timeRange.startTs) / 3600000;
  let totalChecks = 0;
  let totalBreaches = 0;
  const perParam = params.map((p) => {
    const series = seriesFor(readings, p.key as any);
    const breaches = series.filter((r) => r.v < p.min || r.v > p.max).length;
    totalChecks += series.length;
    totalBreaches += breaches;
    return { spec: p, series, breaches, breachRate: series.length ? breaches / series.length : 0 };
  });

  const compliance = totalChecks ? ((totalChecks - totalBreaches) / totalChecks) * 100 : 100;
  const topRisk = [...perParam].sort((a, b) => b.breachRate - a.breachRate).slice(0, 5);

  // Gauge for compliance
  const gaugeOptions: any = {
    chart: { type: "solidgauge", height: 240, backgroundColor: "transparent" },
    pane: {
      center: ["50%", "75%"],
      size: "130%",
      startAngle: -90,
      endAngle: 90,
      background: [{ backgroundColor: "#f0f0f2", innerRadius: "75%", outerRadius: "100%", shape: "arc", borderWidth: 0 }] as any,
    },
    yAxis: {
      min: 0,
      max: 100,
      stops: [
        [0.0, "#ff3b30"],
        [0.85, "#ff9f0a"],
        [0.95, "#30d158"],
      ],
      lineWidth: 0,
      tickWidth: 0,
      minorTickInterval: null as any,
      labels: { enabled: false },
    },
    plotOptions: {
      solidgauge: {
        dataLabels: {
          y: -30,
          borderWidth: 0,
          useHTML: true,
          format: `<div style="text-align:center"><div style="font-size:36px;font-weight:500;color:#1d1d1f" class="tnum">{y:.1f}<span style="font-size:18px;color:#6e6e73">%</span></div></div>`,
        },
      },
    },
    series: [{ type: "solidgauge", name: "Compliance", data: [compliance] }],
    tooltip: { enabled: false },
  };

  // Breach by parameter pie/column
  const breachOptions: any = {
    chart: { type: "column", height: 220 },
    xAxis: { categories: perParam.map((p) => p.spec.label), labels: { rotation: -30, style: { fontSize: "10px" } } },
    yAxis: { title: { text: undefined } },
    tooltip: {
      formatter: function (this: any) {
        const p = perParam[this.point.index];
        return `<b>${p.spec.label}</b><br/>${p.breaches} breaches<br/>${(p.breachRate * 100).toFixed(1)}% rate`;
      },
    },
    plotOptions: {
      column: {
        borderRadius: 2,
        cursor: "pointer",
        events: {
          click: function (e: any) {
            onSelectParam(perParam[e.point.index].spec.key);
          },
        },
      },
    },
    series: [
      {
        type: "column",
        name: "Breaches",
        data: perParam.map((p) => ({ y: p.breaches, color: p.breaches > 0 ? "#ff3b30" : "#1d1d1f" })),
      },
    ],
  };

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="card px-6 py-5 col-span-1">
          <div className="label">Plant Compliance</div>
          <Chart options={gaugeOptions} />
        </div>
        <div className="card px-6 py-5 col-span-2">
          <div className="label mb-2">Breaches by parameter · click to drill</div>
          <Chart options={breachOptions} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Total Checks" value={totalChecks.toLocaleString()} />
        <Tile label="Breach Events" value={String(totalBreaches)} tone={totalBreaches > 0 ? "breach" : undefined} />
        <Tile label="Window" value={timeRange.label} />
      </div>

      {/* Small multiples */}
      <div className="card px-6 py-5">
        <div className="label mb-3">All parameters · click to drill</div>
        <div className="grid grid-cols-3 gap-4">
          {perParam.map(({ spec: p, series, breaches }) => {
            const opts: any = {
              chart: { type: "areaspline", height: 90, margin: [10, 5, 20, 5], backgroundColor: "transparent" },
              xAxis: { type: "datetime", labels: { enabled: false }, lineWidth: 0, tickLength: 0 },
              yAxis: {
                visible: false,
                plotBands: [{ from: p.min, to: p.max, color: "rgba(29,29,31,0.04)" }],
              },
              tooltip: {
                formatter: function (this: any) {
                  return `<b>${this.y.toFixed(p.decimals)}</b> ${p.unit}<br/><span style="opacity:0.6">${new Date(this.x).toUTCString().slice(5, 17)}</span>`;
                },
              },
              plotOptions: { areaspline: { fillOpacity: 0.08, marker: { enabled: false } } },
              series: [
                {
                  type: "areaspline",
                  data: series.map((s) => [s.ts, s.v]),
                  color: breaches > 0 ? "#ff3b30" : "#1d1d1f",
                  zones: [
                    { value: p.min, color: "#ff3b30" },
                    { value: p.max, color: "#1d1d1f" },
                    { color: "#ff3b30" },
                  ],
                },
              ],
            };
            return (
              <button
                key={p.key}
                onClick={() => onSelectParam(p.key)}
                className="text-left hover:bg-[var(--bg)] rounded-lg p-2 transition-colors"
              >
                <div className="flex justify-between items-baseline mb-1">
                  <div className="text-[12px] font-medium">{p.label}</div>
                  {breaches > 0 && <div className="text-[10px] text-[var(--breach)]">{breaches} breach</div>}
                </div>
                <Chart options={opts} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Top risk */}
      <div className="card px-6 py-5">
        <div className="label mb-3">Top Risk Parameters</div>
        <table className="w-full text-[12px]">
          <thead className="text-[var(--ink-2)]">
            <tr>
              <th className="text-left font-normal py-2">Parameter</th>
              <th className="text-right font-normal py-2">Breaches</th>
              <th className="text-right font-normal py-2">Rate</th>
              <th className="text-right font-normal py-2"></th>
            </tr>
          </thead>
          <tbody>
            {topRisk.map(({ spec: p, breaches, breachRate }) => (
              <tr key={p.key} className="border-t border-[var(--hairline)]">
                <td className="py-2.5">{p.label}</td>
                <td className="py-2.5 text-right tnum" style={{ color: breaches > 0 ? "var(--breach)" : undefined }}>{breaches}</td>
                <td className="py-2.5 text-right tnum">{(breachRate * 100).toFixed(1)}%</td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => onSelectParam(p.key)}
                    className="text-[11px] text-[var(--ink-2)] hover:text-[var(--ink)]"
                  >
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "breach" }) {
  return (
    <div className="card px-6 py-5">
      <div className="label">{label}</div>
      <div className="text-[28px] font-medium tnum mt-2" style={{ color: tone === "breach" ? "var(--breach)" : undefined }}>
        {value}
      </div>
    </div>
  );
}
