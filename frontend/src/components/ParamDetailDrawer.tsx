"use client";

import { useEffect, useMemo, useState } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, seriesFor, NOW_TS } from "../lib/mockData";
import { Chart } from "./Chart";
import { TimePicker, TimeRange, computePreset } from "./TimePicker";
import { fmtDateTimeIST, fmtDateIST, startOfIstDay, DAY_MS } from "../lib/ist";
import { controlLimits, capability, ratingColor } from "../lib/sixsigma";
import { slotStatusForDay, SLOTS, SlotStatus } from "../lib/slots";

interface Props {
  paramKey: string | null;
  params: ParamSpec[];
  readings: Reading[];
  onClose: () => void;
}

const DEFAULT_DRAWER_RANGE: TimeRange = computePreset("previous7Days", NOW_TS);

export function ParamDetailDrawer({ paramKey, params, readings, onClose }: Props) {
  const [drawerRange, setDrawerRange] = useState<TimeRange>(DEFAULT_DRAWER_RANGE);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  useEffect(() => {
    if (paramKey) setDrawerRange(DEFAULT_DRAWER_RANGE);
  }, [paramKey]);

  const filtered = useMemo(
    () => readings.filter((r) => r.ts >= drawerRange.startTs && r.ts <= drawerRange.endTs),
    [readings, drawerRange]
  );

  // Slot completion per day in the selected window — computed before any early
  // return so React sees the same hook order on every render.
  const dayBreakdown = useMemo(() => {
    const startDay = startOfIstDay(drawerRange.startTs);
    const endDay = startOfIstDay(drawerRange.endTs);
    const out: { dayTs: number; slots: ReturnType<typeof slotStatusForDay> }[] = [];
    for (let d = endDay; d >= startDay; d -= DAY_MS) {
      out.push({ dayTs: d, slots: slotStatusForDay(d, filtered) });
    }
    return out;
  }, [filtered, drawerRange]);

  if (!paramKey) return null;
  const spec = params.find((p) => p.key === paramKey);
  if (!spec) return null;

  const series = seriesFor(filtered, spec.key as any);
  const values = series.map((s) => s.v);
  const breaches = values.filter((v) => v < spec.min || v > spec.max).length;
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 0;
  const avgV = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const limits = controlLimits(values);
  const cap = capability(values, spec.min, spec.max);
  const ratingC = ratingColor(cap.rating);

  // Main trend chart — adds UCL/LCL dashed orange lines on top of spec limits
  const trendPlotLines: any[] = [
    { value: spec.min, color: "#ff3b30", dashStyle: "Dash", width: 1, label: { text: `LSL ${spec.min}`, align: "right", style: { color: "#ff3b30", fontSize: "10px" } } },
    { value: spec.max, color: "#ff3b30", dashStyle: "Dash", width: 1, label: { text: `USL ${spec.max}`, align: "right", style: { color: "#ff3b30", fontSize: "10px" } } },
  ];
  if (values.length >= 2 && limits.sigma > 0) {
    trendPlotLines.push(
      { value: limits.ucl, color: "#f59e0b", dashStyle: "ShortDash", width: 1, label: { text: `UCL ${limits.ucl.toFixed(spec.decimals)}`, align: "left", style: { color: "#d97706", fontSize: "10px" } } },
      { value: limits.lcl, color: "#f59e0b", dashStyle: "ShortDash", width: 1, label: { text: `LCL ${limits.lcl.toFixed(spec.decimals)}`, align: "left", style: { color: "#d97706", fontSize: "10px" } } },
      { value: limits.mean, color: "#3b82f6", dashStyle: "Dot", width: 1, label: { text: `μ ${limits.mean.toFixed(spec.decimals)}`, align: "left", style: { color: "#2563eb", fontSize: "10px" } } },
    );
  }

  const trendOptions: any = {
    chart: { type: "spline", height: 300 },
    xAxis: { type: "datetime" },
    yAxis: {
      plotBands: [
        { from: spec.min, to: spec.max, color: "rgba(48,209,88,0.06)", label: { text: "Acceptable", style: { color: "#6e6e73", fontSize: "10px" } } },
      ],
      plotLines: trendPlotLines,
    },
    tooltip: {
      formatter: function (this: any) {
        const breach = this.y < spec.min || this.y > spec.max;
        return `<div style="padding:4px"><div style="opacity:0.7;font-size:11px">${fmtDateTimeIST(this.x)}</div><div style="font-size:14px;font-weight:500;color:${breach ? "#ff453a" : "#fff"}">${this.y.toFixed(spec.decimals)} ${spec.unit}</div>${breach ? '<div style="font-size:10px;color:#ff453a">OUT OF SPECIFICATION</div>' : ""}</div>`;
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
      <div className="absolute right-0 top-0 h-full w-[820px] bg-[var(--surface)] shadow-2xl flex flex-col">
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

          {/* Six Sigma */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Six Sigma · Process Capability</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 12,
                  border: `1px solid ${ratingC.border}`,
                  background: ratingC.bg,
                  color: ratingC.fg,
                }}
              >
                {cap.rating}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Stat
                label="UCL · μ+3σ"
                value={limits.sigma > 0 ? limits.ucl.toFixed(spec.decimals) : "—"}
                unit={spec.unit}
              />
              <Stat
                label="LCL · μ−3σ"
                value={limits.sigma > 0 ? limits.lcl.toFixed(spec.decimals) : "—"}
                unit={spec.unit}
              />
              <Stat
                label="Cp"
                value={cap.cp !== null ? cap.cp.toFixed(2) : "—"}
                unit=""
                tooltip="Process potential: (USL − LSL) / (6σ)"
              />
              <Stat
                label="Cpk"
                value={cap.cpk !== null ? cap.cpk.toFixed(2) : "—"}
                unit=""
                tooltip="Centred capability: min((USL−μ)/3σ, (μ−LSL)/3σ)"
                tone={
                  cap.rating === "Inadequate" ? "breach" :
                  cap.rating === "Marginal"   ? "warn"   : undefined
                }
              />
            </div>
            <div className="text-[11px] text-[var(--ink-2)] mt-2">
              σ = {limits.sigma.toFixed(spec.decimals || 2)} {spec.unit} · n = {values.length}
              {" · "}Rating: Excellent Cpk≥1.67, Adequate ≥1.33, Marginal ≥1.00
            </div>
          </div>

          {/* Trend */}
          <div>
            <div className="label mb-2">Trend · {drawerRange.label} · with Control Limits</div>
            <Chart options={trendOptions} />
          </div>

          {/* Slot completion */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Slot Completion · {drawerRange.label}</div>
              <div className="flex items-center gap-3 text-[10px] text-[var(--ink-2)]">
                <LegendDot color="var(--ok)"     label="Filled" />
                <LegendDot color="#3b82f6"       label="Multi" />
                <LegendDot color="var(--breach)" label="Missed" />
                <LegendDot color="#e2e8f0"       label="Future" />
              </div>
            </div>
            <div className="border border-[var(--hairline)] rounded-lg overflow-hidden">
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                <table className="w-full text-[12px] tnum">
                  <thead className="bg-[var(--bg)] text-[var(--ink-2)] sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-normal" style={{ width: 130 }}>Date</th>
                      {SLOTS.map((s) => (
                        <th key={s.label} className="text-center px-1 py-2 font-normal">{s.label}</th>
                      ))}
                      <th className="text-right px-3 py-2 font-normal" style={{ width: 64 }}>Filled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBreakdown.map(({ dayTs, slots }) => {
                      const filled = slots.filter((s) => s.status === "filled" || s.status === "multi").length;
                      const expected = slots.filter((s) => s.status !== "future").length;
                      return (
                        <tr key={dayTs} className="border-t border-[var(--hairline)]">
                          <td className="px-3 py-2">{fmtDateIST(dayTs)}</td>
                          {slots.map((s) => (
                            <td key={s.slotIndex} className="text-center py-2">
                              <SlotDot status={s.status} count={s.count} />
                            </td>
                          ))}
                          <td className="text-right px-3 py-2 text-[var(--ink-2)]">
                            {filled}/{expected}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Distribution */}
          <div>
            <div className="label mb-2">Distribution</div>
            <Chart options={distOptions} />
          </div>

          {/* Recent readings */}
          <div>
            <div className="label mb-2">Recent readings</div>
            <div className="border border-[var(--hairline)] rounded-lg overflow-hidden">
              <table className="w-full text-[12px] tnum">
                <thead className="bg-[var(--bg)] text-[var(--ink-2)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal">Time</th>
                    <th className="text-left px-3 py-2 font-normal">Value</th>
                    <th className="text-left px-3 py-2 font-normal">Operator</th>
                    <th className="text-left px-3 py-2 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {series.slice(-12).reverse().map((s, i) => {
                    const breach = s.v < spec.min || s.v > spec.max;
                    return (
                      <tr key={i} className="border-t border-[var(--hairline)]">
                        <td className="px-3 py-2">{fmtDateTimeIST(s.ts)}</td>
                        <td className="px-3 py-2" style={{ color: breach ? "var(--breach)" : undefined }}>
                          {s.v.toFixed(spec.decimals)} {spec.unit}
                        </td>
                        <td className="px-3 py-2">{s.operator}</td>
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

function Stat({
  label,
  value,
  unit,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "breach" | "warn";
  tooltip?: string;
}) {
  const color =
    tone === "breach" ? "var(--breach)" :
    tone === "warn"   ? "var(--warn)"   : undefined;
  return (
    <div className="card px-4 py-3" title={tooltip}>
      <div className="label text-[10px]">{label}</div>
      <div className="text-[18px] font-medium tnum mt-1" style={{ color }}>
        {value}
      </div>
      {unit && <div className="text-[10px] text-[var(--ink-2)]">{unit}</div>}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function SlotDot({ status, count }: { status: SlotStatus; count: number }) {
  const color =
    status === "filled" ? "var(--ok)" :
    status === "multi"  ? "#3b82f6"   :
    status === "missed" ? "var(--breach)" : "#e2e8f0";
  const title =
    status === "filled" ? "1 submission" :
    status === "multi"  ? `${count} submissions` :
    status === "missed" ? "Missed — no submission" :
    "Not yet due";
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: status === "future" ? color : `color-mix(in srgb, ${color} 20%, white)`,
        border: `1.5px solid ${status === "future" ? "#cbd5e1" : color}`,
        fontSize: 10,
        fontWeight: 600,
        color:
          status === "future" ? "#94a3b8" :
          status === "filled" ? "#166534" :
          status === "multi"  ? "#1e3a8a" :
          "#991b1b",
      }}
    >
      {status === "missed" ? "×" : status === "future" ? "" : count}
    </span>
  );
}
