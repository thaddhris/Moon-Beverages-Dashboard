"use client";

import { useMemo, useState, useEffect } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, seriesFor, NOW_TS } from "../lib/mockData";
import { TimeRange, computePreset } from "./TimePicker";
import { controlLimits, capability, ratingColor } from "../lib/sixsigma";
import { fmtDateTimeIST } from "../lib/ist";
import { Chart } from "./Chart";

type PeriodKey =
  | "today" | "yesterday"
  | "currentWeek" | "previousWeek"
  | "currentMonth" | "previousMonth";

const PRESETS: { key: PeriodKey; label: string }[] = [
  { key: "today",         label: "Today" },
  { key: "yesterday",     label: "Yesterday" },
  { key: "currentWeek",   label: "This Week" },
  { key: "previousWeek",  label: "Previous Week" },
  { key: "currentMonth",  label: "This Month" },
  { key: "previousMonth", label: "Previous Month" },
];

const ZONE_COLOR = {
  normal:  "#22c55e", // green — within ±1σ
  caution: "#eab308", // yellow — ±1σ..±2σ
  warning: "#f97316", // orange — ±2σ..±3σ
  ooc:     "#ef4444", // red — outside ±3σ OR outside spec
};

type Zone = keyof typeof ZONE_COLOR;

function zoneFor(
  v: number,
  mean: number,
  sigma: number,
  lsl: number,
  usl: number,
  ucl?: number,
  lcl?: number
): Zone {
  if (v < lsl || v > usl) return "ooc";
  // If explicit UCL/LCL are given, use them for the outer-bound check.
  if (ucl !== undefined && lcl !== undefined) {
    if (v > ucl || v < lcl) return "ooc";
  }
  if (sigma === 0) return "normal";
  const z = Math.abs((v - mean) / sigma);
  if (z >= 3) return "ooc";
  if (z >= 2) return "warning";
  if (z >= 1) return "caution";
  return "normal";
}

// Visibility toggles for the five reference lines
type LineKey = "mean" | "ucl" | "lcl" | "usl" | "lsl";
const DEFAULT_VISIBLE: Record<LineKey, boolean> = {
  mean: true, ucl: true, lcl: true, usl: true, lsl: true,
};

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  onSelectParam: (key: string) => void;
  waterLabel?: string;
}

export function AnalysisView({
  params,
  readings,
  range,
  onRangeChange,
  onSelectParam,
  waterLabel,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(params[0]?.key ?? "");
  const [visible, setVisible] = useState<Record<LineKey, boolean>>(DEFAULT_VISIBLE);
  const toggleLine = (k: LineKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  // Reset selection if params change and current isn't present
  useEffect(() => {
    if (!params.some((p) => p.key === selectedKey)) {
      setSelectedKey(params[0]?.key ?? "");
    }
  }, [params, selectedKey]);

  const filtered = useMemo(
    () => readings.filter((r) => r.ts >= range.startTs && r.ts <= range.endTs),
    [readings, range]
  );

  const spec = params.find((p) => p.key === selectedKey);
  const series = spec ? seriesFor(filtered, spec.key as any) : [];
  const values = series.map((s) => s.v);
  const autoLim = controlLimits(values);
  // Effective UCL/LCL — override wins if provided
  const effectiveUcl = spec?.uclOverride ?? autoLim.ucl;
  const effectiveLcl = spec?.lclOverride ?? autoLim.lcl;
  const usingUclOverride = spec?.uclOverride !== undefined;
  const usingLclOverride = spec?.lclOverride !== undefined;
  const lim = { ...autoLim, ucl: effectiveUcl, lcl: effectiveLcl };
  const cap = spec ? capability(values, spec.min, spec.max) : { cp: null, cpk: null, rating: "Insufficient Data" as const };
  const ratingC = ratingColor(cap.rating);

  const zoneCounts = useMemo(() => {
    const c = { normal: 0, caution: 0, warning: 0, ooc: 0 };
    if (!spec) return c;
    for (const v of values) {
      c[zoneFor(v, autoLim.mean, autoLim.sigma, spec.min, spec.max, effectiveUcl, effectiveLcl)]++;
    }
    return c;
  }, [values, autoLim, spec, effectiveUcl, effectiveLcl]);

  // All-param capability summary
  const summary = useMemo(
    () =>
      params.map((p) => {
        const s = seriesFor(filtered, p.key as any);
        const vs = s.map((x) => x.v);
        const l = controlLimits(vs);
        const c = capability(vs, p.min, p.max);
        return { p, n: vs.length, l, c };
      }),
    [params, filtered]
  );

  const fmt = spec ? (n: number) => n.toFixed(spec.decimals) : (n: number) => n.toFixed(2);

  const chartOptions: any =
    spec && series.length
      ? buildChartOptions(spec, series, autoLim, lim, fmt, visible)
      : null;

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium">
            {waterLabel ? `${waterLabel} · ` : ""}Six Sigma Analysis
          </div>
          <div className="text-[22px] font-medium tracking-tight mt-0.5">
            Control Chart · {range.label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ParamSelector
            params={params}
            current={selectedKey}
            onChange={setSelectedKey}
          />
          <PeriodSelector
            current={range.label}
            onSelect={(key) => onRangeChange(computePreset(key, NOW_TS))}
          />
        </div>
      </div>

      {/* Main control chart card */}
      <div className="card px-5 py-4 mb-4">
        {/* Legend row — each pill doubles as a visibility toggle */}
        <div className="flex items-center flex-wrap gap-4 mb-3 text-[11px]">
          <div className="flex items-center gap-2">
            <LineToggle label="Mean" color="#10b981" solid active={visible.mean} onClick={() => toggleLine("mean")} />
            <LineToggle
              label={`UCL${usingUclOverride ? " *" : ""}`}
              color="#ef4444"
              dashed
              active={visible.ucl}
              onClick={() => toggleLine("ucl")}
              title={usingUclOverride ? "Manual UCL (from Settings)" : "UCL = μ + 3σ (auto)"}
            />
            <LineToggle
              label={`LCL${usingLclOverride ? " *" : ""}`}
              color="#ef4444"
              dashed
              active={visible.lcl}
              onClick={() => toggleLine("lcl")}
              title={usingLclOverride ? "Manual LCL (from Settings)" : "LCL = μ − 3σ (auto)"}
            />
            <LineToggle label="USL" color="#64748b" dotted active={visible.usl} onClick={() => toggleLine("usl")} />
            <LineToggle label="LSL" color="#64748b" dotted active={visible.lsl} onClick={() => toggleLine("lsl")} />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <DotPill color={ZONE_COLOR.normal}  label="Normal" />
            <DotPill color={ZONE_COLOR.caution} label="Caution" />
            <DotPill color={ZONE_COLOR.warning} label="Warning" />
            <DotPill color={ZONE_COLOR.ooc}     label="Out of Control" />
          </div>
        </div>

        {/* The chart */}
        {chartOptions ? (
          <Chart options={chartOptions} />
        ) : (
          <div
            style={{
              height: 420,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-2)",
              fontSize: 13,
              border: "1px dashed #e2e8f0",
              borderRadius: 8,
            }}
          >
            {values.length === 0
              ? `No samples for ${spec?.label ?? "this parameter"} in ${range.label}`
              : "Select a parameter to analyse"}
          </div>
        )}

        {/* Capability stats + status counts */}
        <div className="grid grid-cols-8 gap-2 mt-4">
          <Tile label="n" value={String(values.length)} />
          <Tile label="μ (Mean)"  value={values.length ? fmt(lim.mean) : "—"} unit={spec?.unit} />
          <Tile label="σ (Stddev)" value={lim.sigma > 0 ? fmt(lim.sigma) : "—"} unit={spec?.unit} />
          <Tile
            label={`UCL${usingUclOverride ? " · manual" : ""}`}
            value={isFinite(lim.ucl) ? fmt(lim.ucl) : "—"}
            unit={spec?.unit}
          />
          <Tile
            label={`LCL${usingLclOverride ? " · manual" : ""}`}
            value={isFinite(lim.lcl) ? fmt(lim.lcl) : "—"}
            unit={spec?.unit}
          />
          <Tile
            label="Cp"
            value={cap.cp !== null ? cap.cp.toFixed(2) : "—"}
            tone={cap.cp !== null && cap.cp < 1 ? "breach" : undefined}
          />
          <Tile
            label="Cpk"
            value={cap.cpk !== null ? cap.cpk.toFixed(2) : "—"}
            tone={
              cap.cpk !== null && cap.cpk < 1 ? "breach" :
              cap.cpk !== null && cap.cpk < 1.33 ? "warn" : undefined
            }
          />
          <RatingTile rating={cap.rating} color={ratingC} />
        </div>

        {/* Zone distribution */}
        <div className="flex items-center gap-2 mt-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">
            Sample distribution
          </div>
          <ZoneCount label="Normal"  count={zoneCounts.normal}  color={ZONE_COLOR.normal} />
          <ZoneCount label="Caution" count={zoneCounts.caution} color={ZONE_COLOR.caution} />
          <ZoneCount label="Warning" count={zoneCounts.warning} color={ZONE_COLOR.warning} />
          <ZoneCount label="Out of Control" count={zoneCounts.ooc} color={ZONE_COLOR.ooc} />
          {spec && (
            <button
              onClick={() => onSelectParam(spec.key)}
              className="ml-auto text-[11px] text-[#1d4ed8] hover:underline"
            >
              Open full drill-in →
            </button>
          )}
        </div>
      </div>

      {/* All-parameter summary — compact */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--hairline)] text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">
          Capability · All Parameters
        </div>
        <table className="w-full text-[12px] tnum">
          <thead className="bg-[var(--bg)] text-[var(--ink-2)]">
            <tr>
              <th className="text-left px-4 py-2 font-medium" style={{ width: 180 }}>Parameter</th>
              <th className="text-right px-3 py-2 font-medium">n</th>
              <th className="text-right px-3 py-2 font-medium">μ</th>
              <th className="text-right px-3 py-2 font-medium">σ</th>
              <th className="text-right px-3 py-2 font-medium">UCL</th>
              <th className="text-right px-3 py-2 font-medium">LCL</th>
              <th className="text-right px-3 py-2 font-medium">Cp</th>
              <th className="text-right px-3 py-2 font-medium">Cpk</th>
              <th className="text-left px-3 py-2 font-medium" style={{ width: 130 }}>Rating</th>
            </tr>
          </thead>
          <tbody>
            {summary.map(({ p, n, l, c }) => {
              const rc = ratingColor(c.rating);
              const f = (x: number) => x.toFixed(p.decimals);
              const isSelected = p.key === selectedKey;
              return (
                <tr
                  key={p.key}
                  className="border-t border-[var(--hairline)] cursor-pointer hover:bg-[var(--bg)]"
                  style={{ background: isSelected ? "#eff6ff" : undefined }}
                  onClick={() => setSelectedKey(p.key)}
                >
                  <td className="px-4 py-2 font-medium" style={{ color: "#1e293b" }}>
                    {isSelected && <span style={{ color: "#2563eb", marginRight: 6 }}>▸</span>}
                    {p.label}
                  </td>
                  <td className="text-right px-3 py-2">{n}</td>
                  <td className="text-right px-3 py-2">{n ? f(l.mean) : "—"}</td>
                  <td className="text-right px-3 py-2">{l.sigma > 0 ? f(l.sigma) : "—"}</td>
                  <td className="text-right px-3 py-2">{l.sigma > 0 ? f(l.ucl) : "—"}</td>
                  <td className="text-right px-3 py-2">{l.sigma > 0 ? f(l.lcl) : "—"}</td>
                  <td className="text-right px-3 py-2" style={{ color: c.cp !== null && c.cp < 1 ? "var(--breach)" : undefined }}>
                    {c.cp !== null ? c.cp.toFixed(2) : "—"}
                  </td>
                  <td
                    className="text-right px-3 py-2"
                    style={{
                      fontWeight: 600,
                      color:
                        c.cpk !== null && c.cpk < 1 ? "var(--breach)" :
                        c.cpk !== null && c.cpk < 1.33 ? "var(--warn)" : undefined,
                    }}
                  >
                    {c.cpk !== null ? c.cpk.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        border: `1px solid ${rc.border}`,
                        background: rc.bg,
                        color: rc.fg,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.rating}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Chart builder
// ──────────────────────────────────────────────────────────────

function buildChartOptions(
  spec: ParamSpec,
  series: { ts: number; v: number }[],
  autoLim: { mean: number; sigma: number; ucl: number; lcl: number },
  lim: { mean: number; sigma: number; ucl: number; lcl: number },
  fmt: (n: number) => string,
  visible: Record<LineKey, boolean>
) {
  const points = series.map((s) => {
    const zone = zoneFor(s.v, autoLim.mean, autoLim.sigma, spec.min, spec.max, lim.ucl, lim.lcl);
    return {
      x: s.ts,
      y: s.v,
      color: ZONE_COLOR[zone],
      marker: {
        fillColor: ZONE_COLOR[zone],
        lineColor: ZONE_COLOR[zone],
        radius: 4,
      },
      zone,
    };
  });

  const plotLines: any[] = [];
  if (visible.mean && autoLim.sigma > 0) {
    plotLines.push({
      value: lim.mean, color: "#10b981", width: 2, zIndex: 3,
      label: { text: `Mean (${fmt(lim.mean)})`, align: "right", x: -8, y: -4, style: { color: "#10b981", fontSize: "10px", fontWeight: "500" } },
    });
  }
  if (visible.ucl && isFinite(lim.ucl)) {
    plotLines.push({
      value: lim.ucl, color: "#ef4444", dashStyle: "Dash", width: 1, zIndex: 3,
      label: { text: `UCL (${fmt(lim.ucl)})`, align: "right", x: -8, y: -4, style: { color: "#ef4444", fontSize: "10px" } },
    });
  }
  if (visible.lcl && isFinite(lim.lcl)) {
    plotLines.push({
      value: lim.lcl, color: "#ef4444", dashStyle: "Dash", width: 1, zIndex: 3,
      label: { text: `LCL (${fmt(lim.lcl)})`, align: "right", x: -8, y: 12, style: { color: "#ef4444", fontSize: "10px" } },
    });
  }
  if (visible.usl) {
    plotLines.push({
      value: spec.max, color: "#64748b", dashStyle: "Dot", width: 1, zIndex: 2,
      label: { text: `USL (${spec.max})`, align: "right", x: -8, y: -4, style: { color: "#64748b", fontSize: "10px" } },
    });
  }
  if (visible.lsl) {
    plotLines.push({
      value: spec.min, color: "#64748b", dashStyle: "Dot", width: 1, zIndex: 2,
      label: { text: `LSL (${spec.min})`, align: "right", x: -8, y: 12, style: { color: "#64748b", fontSize: "10px" } },
    });
  }

  const allY = [
    ...series.map((s) => s.v),
    spec.min, spec.max,
    ...(isFinite(lim.ucl) ? [lim.ucl] : []),
    ...(isFinite(lim.lcl) ? [lim.lcl] : []),
  ];
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const pad = (yMax - yMin) * 0.08 || 1;

  return {
    chart: {
      type: "line",
      height: 440,
      spacing: [20, 90, 20, 10], // extra right padding for line labels
      zooming: { type: "x" },
    },
    title: { text: undefined },
    legend: { enabled: false },
    xAxis: {
      type: "datetime",
      labels: { style: { color: "#64748b", fontSize: "10px" } },
      gridLineWidth: 0,
    },
    yAxis: {
      title: { text: `${spec.label} (${spec.unit})`, style: { color: "#64748b", fontSize: "11px" } },
      min: yMin - pad,
      max: yMax + pad,
      plotLines,
      gridLineColor: "#f1f5f9",
      labels: { style: { color: "#64748b", fontSize: "10px" } },
    },
    tooltip: {
      useHTML: true,
      backgroundColor: "#1e293b",
      borderWidth: 0,
      borderRadius: 6,
      padding: 10,
      style: { color: "#f8fafc", fontSize: "12px" },
      formatter: function (this: any) {
        const z = (this.point as any).zone as Zone;
        const zLabel =
          z === "normal" ? "Normal" :
          z === "caution" ? "Caution" :
          z === "warning" ? "Warning" : "Out of Control";
        return `
          <div style="opacity:0.7;font-size:11px">${fmtDateTimeIST(this.x)}</div>
          <div style="font-size:13px;font-weight:500">Value: ${fmt(this.y)} ${spec.unit}</div>
          <div style="font-size:11px;color:${ZONE_COLOR[z]}">Status: <b>${zLabel}</b></div>
        `;
      },
    },
    plotOptions: {
      line: {
        lineWidth: 1.5,
        color: "#93c5fd",
        marker: { enabled: true, symbol: "circle" },
        states: { hover: { lineWidthPlus: 0 } },
      },
    },
    series: [
      {
        type: "line",
        name: spec.label,
        data: points,
      },
    ],
    credits: { enabled: false },
  };
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function LineToggle({
  color,
  label,
  solid,
  dashed,
  dotted,
  active,
  onClick,
  title,
}: {
  color: string;
  label: string;
  solid?: boolean;
  dashed?: boolean;
  dotted?: boolean;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  const style = solid ? "solid" : dashed ? "dashed" : dotted ? "dotted" : "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? (active ? `Hide ${label}` : `Show ${label}`)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        border: `1px solid ${active ? color : "#e2e8f0"}`,
        borderRadius: 12,
        background: active ? `color-mix(in srgb, ${color} 10%, white)` : "white",
        color: active ? color : "#94a3b8",
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      <span
        style={{
          width: 14,
          borderTop: `2px ${style} ${active ? color : "#cbd5e1"}`,
          display: "inline-block",
        }}
      />
      {label}
    </button>
  );
}

function LinePill({ color, label, solid, dashed, dotted }: { color: string; label: string; solid?: boolean; dashed?: boolean; dotted?: boolean }) {
  const style =
    solid ? "solid" : dashed ? "dashed" : dotted ? "dotted" : "solid";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", border: `1px solid ${color}`, borderRadius: 12, background: `color-mix(in srgb, ${color} 8%, white)`, color, fontSize: 11, fontWeight: 500 }}>
      <span style={{ width: 14, borderTop: `2px ${style} ${color}`, display: "inline-block" }} />
      {label}
    </span>
  );
}

function DotPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-2)" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Tile({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "breach" | "warn" }) {
  const color =
    tone === "breach" ? "var(--breach)" :
    tone === "warn"   ? "var(--warn)"   : undefined;
  return (
    <div style={{ padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, background: "white" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)", fontWeight: 500 }}>
        {label}
      </div>
      <div className="tnum" style={{ fontSize: 15, fontWeight: 600, marginTop: 2, color }}>
        {value}
        {unit && value !== "—" && <span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-2)", marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function RatingTile({ rating, color }: { rating: string; color: { fg: string; bg: string; border: string } }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        border: `1px solid ${color.border}`,
        borderRadius: 8,
        background: color.bg,
      }}
    >
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)", fontWeight: 500 }}>
        Rating
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: color.fg }}>
        {rating}
      </div>
    </div>
  );
}

function ZoneCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 12,
        background: `color-mix(in srgb, ${color} 10%, white)`,
        border: `1px solid ${color}`,
        fontSize: 11,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span className="tnum" style={{ fontWeight: 600, color }}>{count}</span>
      <span style={{ color: "var(--ink-2)" }}>{label}</span>
    </span>
  );
}

function ParamSelector({
  params,
  current,
  onChange,
}: {
  params: ParamSpec[];
  current: string;
  onChange: (k: string) => void;
}) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "7px 12px",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        fontFamily: "inherit",
        fontSize: 13,
        color: "#0f172a",
        cursor: "pointer",
        minWidth: 200,
      }}
    >
      {params.map((p) => (
        <option key={p.key} value={p.key}>{p.label} ({p.unit})</option>
      ))}
    </select>
  );
}

function PeriodSelector({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (key: PeriodKey) => void;
}) {
  return (
    <select
      value={PRESETS.find((p) => p.label === current)?.key ?? "currentWeek"}
      onChange={(e) => onSelect(e.target.value as PeriodKey)}
      style={{
        padding: "7px 12px",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        fontFamily: "inherit",
        fontSize: 13,
        color: "#0f172a",
        cursor: "pointer",
        minWidth: 160,
      }}
    >
      {PRESETS.map((p) => (
        <option key={p.key} value={p.key}>{p.label}</option>
      ))}
    </select>
  );
}
