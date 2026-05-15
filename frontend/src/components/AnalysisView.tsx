"use client";

import { useMemo, useState, useEffect } from "react";
import { ParamSpec } from "../lib/config";
import { Reading, seriesFor } from "../lib/mockData";
import { TimeRange } from "./TimePicker";
import { controlLimits, capability, ratingColor } from "../lib/sixsigma";
import { fmtDateTimeIST } from "../lib/ist";
import { Chart } from "./Chart";

const ZONE_COLOR = {
  normal:  "#22c55e",
  caution: "#eab308",
  warning: "#f97316",
  ooc:     "#ef4444",
};
type Zone = keyof typeof ZONE_COLOR;

const CAT_ACCENTS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

function zoneFor(v: number, mean: number, sigma: number, lsl: number, usl: number, ucl?: number, lcl?: number): Zone {
  if (v < lsl || v > usl) return "ooc";
  if (ucl !== undefined && lcl !== undefined && (v > ucl || v < lcl)) return "ooc";
  if (sigma === 0) return "normal";
  const z = Math.abs((v - mean) / sigma);
  if (z >= 3) return "ooc";
  if (z >= 2) return "warning";
  if (z >= 1) return "caution";
  return "normal";
}

type LineKey = "mean" | "ucl" | "lcl" | "usl" | "lsl";
const DEFAULT_VISIBLE: Record<LineKey, boolean> = { mean: true, ucl: true, lcl: true, usl: true, lsl: true };

interface Props {
  params: ParamSpec[];
  readings: Reading[];
  range: TimeRange;
  onSelectParam: (key: string) => void;
  waterLabel?: string;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function AnalysisView({ params, readings, range, onSelectParam, waterLabel }: Props) {
  const isRawWater  = params.some((p) => p.category?.includes("Borewell") || p.category?.includes("Storage Tank"));
  const isSoftWater = params.some((p) => p.category === "Non-Chlorinated");

  const { orderedCategories, paramsByCategory } = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    const map = new Map<string, ParamSpec[]>();
    for (const p of params) {
      const k = p.category ?? "__none__";
      if (p.category && !seen.has(p.category)) { seen.add(p.category); order.push(p.category); }
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return { orderedCategories: order, paramsByCategory: map };
  }, [params]);

  const filteredReadings = useMemo(
    () => readings.filter((r) => r.ts >= range.startTs && r.ts <= range.endTs),
    [readings, range]
  );

  if (isRawWater)  return <RawWaterAnalysis  params={params} filteredReadings={filteredReadings} range={range} onSelectParam={onSelectParam} waterLabel={waterLabel} orderedCategories={orderedCategories} paramsByCategory={paramsByCategory} />;
  if (isSoftWater) return <SoftWaterAnalysis params={params} filteredReadings={filteredReadings} range={range} onSelectParam={onSelectParam} waterLabel={waterLabel} orderedCategories={orderedCategories} paramsByCategory={paramsByCategory} />;
  return <TreatedWaterAnalysis params={params} filteredReadings={filteredReadings} range={range} onSelectParam={onSelectParam} waterLabel={waterLabel} />;
}

// ─── Shared types ─────────────────────────────────────────────────────────────

interface SourcedProps {
  params: ParamSpec[];
  filteredReadings: Reading[];
  range: TimeRange;
  onSelectParam: (key: string) => void;
  waterLabel?: string;
  orderedCategories: string[];
  paramsByCategory: Map<string, ParamSpec[]>;
}

interface TreatedProps {
  params: ParamSpec[];
  filteredReadings: Reading[];
  range: TimeRange;
  onSelectParam: (key: string) => void;
  waterLabel?: string;
}

// ─── Shared: KPI pill selector ────────────────────────────────────────────────

function KpiPills({ labels, selected, onSelect }: { labels: string[]; selected: string; onSelect: (l: string) => void }) {
  return (
    <div className="card px-5 py-4 mb-4">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium mb-3">Parameter</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {labels.map((label) => (
          <button
            key={label}
            onClick={() => onSelect(label)}
            className={`px-3 py-1.5 text-[12px] rounded-full transition-colors ${
              selected === label
                ? "bg-[var(--ink)] text-white"
                : "bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── RAW WATER ────────────────────────────────────────────────────────────────

function RawWaterAnalysis({ params, filteredReadings, range, onSelectParam, waterLabel, orderedCategories, paramsByCategory }: SourcedProps) {
  const kpiLabels = useMemo(() => {
    const first = paramsByCategory.get(orderedCategories[0]) ?? [];
    return first.filter((p) => !p.nilSpec).map((p) => p.label);
  }, [orderedCategories, paramsByCategory]);

  const [selectedKpi, setSelectedKpi] = useState(kpiLabels[0] ?? "pH");
  const [visible, setVisible] = useState<Record<"usl" | "lsl", boolean>>({ usl: true, lsl: true });
  const toggleLine = (k: "usl" | "lsl") => setVisible((v) => ({ ...v, [k]: !v[k] }));

  useEffect(() => {
    if (!kpiLabels.includes(selectedKpi)) setSelectedKpi(kpiLabels[0] ?? "");
  }, [kpiLabels, selectedKpi]);

  const kpiPerSource = useMemo(() =>
    orderedCategories.map((src) => ({
      src,
      spec: paramsByCategory.get(src)?.find((p) => p.label === selectedKpi) ?? null,
    })),
  [orderedCategories, paramsByCategory, selectedKpi]);

  const sourceCaps = useMemo(() =>
    kpiPerSource.map(({ src, spec }) => {
      if (!spec) return { src, spec: null, n: 0, cap: capability([], 0, 1), lim: controlLimits([]) };
      const vs = seriesFor(filteredReadings, spec.key as any).map((d) => d.v);
      return { src, spec, n: vs.length, cap: capability(vs, spec.min, spec.max), lim: controlLimits(vs) };
    }),
  [kpiPerSource, filteredReadings]);

  const refSpec = kpiPerSource.find((k) => k.spec)?.spec ?? null;
  const sortedCaps = [...sourceCaps].sort((a, b) => (b.cap.cpk ?? -1) - (a.cap.cpk ?? -1));

  // Multi-source overlay chart
  const multiChart = useMemo(() => {
    if (!refSpec) return null;
    const plotLines: any[] = [];
    if (visible.usl) plotLines.push({ value: refSpec.max, color: "#64748b", dashStyle: "Dot", width: 1.5, zIndex: 2, label: { text: `USL (${refSpec.max})`, align: "right", x: -8, y: -4, style: { color: "#64748b", fontSize: "10px" } } });
    if (visible.lsl) plotLines.push({ value: refSpec.min, color: "#64748b", dashStyle: "Dot", width: 1.5, zIndex: 2, label: { text: `LSL (${refSpec.min})`, align: "right", x: -8, y: 12,  style: { color: "#64748b", fontSize: "10px" } } });

    const seriesList = kpiPerSource.map(({ src, spec }, i) => {
      if (!spec) return null;
      const s = seriesFor(filteredReadings, spec.key as any);
      if (!s.length) return null;
      const color = CAT_ACCENTS[i % CAT_ACCENTS.length];
      return {
        type: "line", name: src,
        data: s.map((d) => ({ x: d.ts, y: d.v, color: (d.v < refSpec.min || d.v > refSpec.max) ? "#ef4444" : color })),
        color, lineWidth: 1.5,
        marker: { enabled: true, radius: 3, symbol: "circle" },
      };
    }).filter(Boolean);
    if (!seriesList.length) return null;
    return {
      chart: { type: "line", height: 380, spacing: [16, 90, 16, 10], zooming: { type: "x" } },
      title: { text: undefined }, credits: { enabled: false },
      legend: { enabled: true, itemStyle: { fontSize: "11px", fontWeight: "500", color: "#334155" } },
      xAxis: { type: "datetime", labels: { style: { color: "#64748b", fontSize: "10px" } }, gridLineWidth: 0 },
      yAxis: { title: { text: `${selectedKpi}${refSpec.unit ? ` (${refSpec.unit})` : ""}`, style: { color: "#64748b", fontSize: "11px" } }, plotLines, gridLineColor: "#f1f5f9", labels: { style: { color: "#64748b", fontSize: "10px" } } },
      tooltip: {
        useHTML: true, shared: false,
        backgroundColor: "#1e293b", borderWidth: 0, borderRadius: 6,
        style: { color: "#f8fafc", fontSize: "12px" },
        formatter: function (this: any) {
          const entry = kpiPerSource.find((k) => k.src === this.series.name);
          const sp = entry?.spec;
          const inSp = sp ? (this.y >= sp.min && this.y <= sp.max) : true;
          return `<div style="opacity:0.7;font-size:11px;margin-bottom:2px">${new Date(this.x).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
            <div style="font-weight:600;margin-bottom:2px">${this.series.name}</div>
            <div style="font-size:13px;font-weight:500">${this.y.toFixed(sp?.decimals ?? 2)} ${sp?.unit ?? ""}</div>
            <div style="font-size:11px;color:${inSp ? "#22c55e" : "#ef4444"};margin-top:2px">${inSp ? "✓ Within Spec" : "✗ Out of Spec"}</div>`;
        },
      },
      plotOptions: { line: { connectNulls: false } },
      series: seriesList,
    };
  }, [kpiPerSource, filteredReadings, refSpec, selectedKpi, visible]);

  // Capability matrix
  const templateParams = useMemo(
    () => (paramsByCategory.get(orderedCategories[0]) ?? []).filter((p) => !p.nilSpec),
    [orderedCategories, paramsByCategory]
  );
  const matrixRows = useMemo(() =>
    templateParams.map((kpi) => ({
      kpi,
      cells: orderedCategories.map((src) => {
        const sp = paramsByCategory.get(src)?.find((p) => p.label === kpi.label);
        if (!sp) return null;
        const vs = seriesFor(filteredReadings, sp.key as any).map((d) => d.v);
        return { sp, n: vs.length, cap: capability(vs, sp.min, sp.max) };
      }),
    })),
  [templateParams, orderedCategories, paramsByCategory, filteredReadings]);

  // Footer: total out-of-spec across all sources
  const { totalN, totalOos } = useMemo(() => {
    let n = 0, oos = 0;
    kpiPerSource.forEach(({ spec }) => {
      if (!spec) return;
      const vs = seriesFor(filteredReadings, spec.key as any);
      n += vs.length;
      oos += vs.filter((d) => d.v < spec.min || d.v > spec.max).length;
    });
    return { totalN: n, totalOos: oos };
  }, [kpiPerSource, filteredReadings]);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      {/* ① Header */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium">{waterLabel} · Six Sigma Analysis</div>
        <div className="text-[22px] font-medium tracking-tight mt-0.5">Source Reliability · {range.label}</div>
      </div>

      {/* ② KPI pills */}
      <KpiPills labels={kpiLabels} selected={selectedKpi} onSelect={setSelectedKpi} />

      {/* ③ Stats card — source ranking */}
      <div className="card px-5 py-4 mb-4">
        <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium mb-4">
          Statistics · {selectedKpi} · All Sources
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedCaps.map(({ src, cap, n }) => {
            const rc   = ratingColor(cap.rating);
            const cpk  = cap.cpk;
            const bar  = cpk !== null ? Math.min(100, Math.max(0, (cpk / 2) * 100)) : 0;
            const srcI = orderedCategories.indexOf(src);
            const acnt = CAT_ACCENTS[srcI % CAT_ACCENTS.length];
            return (
              <div key={src} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, width: 260, flexShrink: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: acnt, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={src}>{src}</span>
                </div>
                <div style={{ flex: 1, height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${bar}%`, background: rc.fg, borderRadius: 5, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ width: 52, textAlign: "right", fontSize: 14, fontWeight: 700, color: rc.fg, flexShrink: 0 }}>
                  {cpk !== null ? cpk.toFixed(2) : "—"}
                </div>
                <div style={{ width: 88, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, border: `1px solid ${rc.border}`, background: rc.bg, color: rc.fg, whiteSpace: "nowrap" }}>
                    {cap.rating}
                  </span>
                </div>
                <div style={{ width: 44, textAlign: "right", fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>n={n}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ④ Chart card */}
      <div className="card px-5 py-4 mb-4">
        <div className="flex items-center flex-wrap gap-4 mb-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium flex-1">
            Individual Values · {selectedKpi} · All Sources
          </div>
          <div className="flex items-center gap-2">
            <LineToggle label="USL" color="#64748b" dotted active={visible.usl} onClick={() => toggleLine("usl")} />
            <LineToggle label="LSL" color="#64748b" dotted active={visible.lsl} onClick={() => toggleLine("lsl")} />
          </div>
          <div className="flex items-center gap-3">
            <DotPill color="#ef4444" label="Out of Spec" />
          </div>
        </div>
        {multiChart ? <Chart options={multiChart} /> : <EmptyChart message={`No data for ${selectedKpi} in ${range.label}`} height={380} />}
        <div className="flex items-center gap-2 mt-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">Sample count</div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 12, background: "color-mix(in srgb, #22c55e 10%, white)", border: "1px solid #22c55e", fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span className="tnum" style={{ fontWeight: 600, color: "#22c55e" }}>{totalN - totalOos}</span>
            <span style={{ color: "var(--ink-2)" }}>In Spec</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 12, background: "color-mix(in srgb, #ef4444 10%, white)", border: "1px solid #ef4444", fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
            <span className="tnum" style={{ fontWeight: 600, color: "#ef4444" }}>{totalOos}</span>
            <span style={{ color: "var(--ink-2)" }}>Out of Spec</span>
          </span>
        </div>
      </div>

      {/* ⑤ Table card — capability matrix */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--hairline)]">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">
            Capability Matrix · Cpk · All KPIs × All Sources
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ textAlign: "left", padding: "8px 16px", fontWeight: 600, fontSize: 11, color: "#475569", borderBottom: "1px solid #e2e8f0", position: "sticky", left: 0, zIndex: 10, background: "#f8fafc", minWidth: 130 }}>KPI</th>
                {orderedCategories.map((src, i) => (
                  <th key={src} style={{ textAlign: "center", padding: "8px 10px", fontWeight: 600, fontSize: 10, color: CAT_ACCENTS[i % CAT_ACCENTS.length], borderBottom: `2px solid ${CAT_ACCENTS[i % CAT_ACCENTS.length]}`, minWidth: 88, whiteSpace: "nowrap" }}>
                    {src.replace(" Storage Tank", " ST").replace("Borewell No.", "BW").replace(" · Residual Cl₂", " Res.")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map(({ kpi, cells }) => {
                const isSelected = selectedKpi === kpi.label;
                return (
                  <tr key={kpi.key} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: isSelected ? "#eff6ff" : "white" }} onClick={() => setSelectedKpi(kpi.label)}>
                    <td style={{ padding: "8px 16px", fontWeight: 500, color: "#1e293b", position: "sticky", left: 0, zIndex: 5, background: isSelected ? "#eff6ff" : "white", fontSize: 12 }}>
                      {isSelected && <span style={{ color: "#2563eb", marginRight: 6 }}>▸</span>}{kpi.label}
                    </td>
                    {cells.map((cell, ci) => {
                      if (!cell) return <td key={ci} style={{ textAlign: "center", padding: "8px 6px", color: "#cbd5e1", fontSize: 12 }}>—</td>;
                      const rc = ratingColor(cell.cap.rating);
                      const cpk = cell.cap.cpk;
                      return (
                        <td key={ci} style={{ textAlign: "center", padding: "7px 6px", background: cpk !== null ? rc.bg : "white" }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: rc.fg }}>{cpk !== null ? cpk.toFixed(2) : cell.n < 2 ? <span style={{ color: "#cbd5e1" }}>—</span> : "—"}</span>
                          {cell.n < 3 && cell.n > 0 && <span style={{ fontSize: 9, color: "#94a3b8", display: "block", lineHeight: 1.2 }}>n={cell.n}</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SOFT WATER ───────────────────────────────────────────────────────────────

function SoftWaterAnalysis({ params, filteredReadings, range, onSelectParam, waterLabel, orderedCategories, paramsByCategory }: SourcedProps) {
  const ncCat = orderedCategories.find((c) => c.includes("Non-Chlorinated")) ?? orderedCategories[0] ?? "";
  const chCat = orderedCategories.find((c) => c.includes("Chlorinated") && !c.includes("Non")) ?? orderedCategories[1] ?? "";

  const ncParams = paramsByCategory.get(ncCat) ?? [];
  const chParams = paramsByCategory.get(chCat) ?? [];
  const kpiLabels = ncParams.filter((p) => !p.nilSpec).map((p) => p.label);

  const [selectedKpi, setSelectedKpi] = useState(kpiLabels[0] ?? "pH");
  const [visible, setVisible] = useState<Record<"mean" | "ucl" | "lcl" | "usl" | "lsl", boolean>>(DEFAULT_VISIBLE);
  const toggleLine = (k: LineKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  useEffect(() => {
    if (!kpiLabels.includes(selectedKpi)) setSelectedKpi(kpiLabels[0] ?? "");
  }, [kpiLabels, selectedKpi]);

  const ncSpec = ncParams.find((p) => p.label === selectedKpi) ?? null;
  const chSpec = chParams.find((p) => p.label === selectedKpi) ?? null;
  const refSpec = ncSpec ?? chSpec;

  const ncSeries = useMemo(() => ncSpec ? seriesFor(filteredReadings, ncSpec.key as any) : [], [filteredReadings, ncSpec]);
  const chSeries = useMemo(() => chSpec ? seriesFor(filteredReadings, chSpec.key as any) : [], [filteredReadings, chSpec]);

  const ncCap = useMemo(() => ncSpec ? capability(ncSeries.map((s) => s.v), ncSpec.min, ncSpec.max) : capability([], 0, 1), [ncSeries, ncSpec]);
  const chCap = useMemo(() => chSpec ? capability(chSeries.map((s) => s.v), chSpec.min, chSpec.max) : capability([], 0, 1), [chSeries, chSpec]);
  const ncLim = useMemo(() => controlLimits(ncSeries.map((s) => s.v)), [ncSeries]);
  const chLim = useMemo(() => controlLimits(chSeries.map((s) => s.v)), [chSeries]);

  const lineInfo = [
    { key: "nc", cat: ncCat, spec: ncSpec, cap: ncCap, lim: ncLim, series: ncSeries, color: "#3b82f6" },
    { key: "ch", cat: chCat, spec: chSpec, cap: chCap, lim: chLim, series: chSeries, color: "#10b981" },
  ];

  const dualChart = useMemo(() => {
    if (!refSpec) return null;
    const plotLines: any[] = [];
    if (visible.usl)  plotLines.push({ value: refSpec.max, color: "#64748b", dashStyle: "Dot",  width: 1.5, zIndex: 2, label: { text: `USL (${refSpec.max})`, align: "right", x: -8, y: -4, style: { color: "#64748b", fontSize: "10px" } } });
    if (visible.lsl)  plotLines.push({ value: refSpec.min, color: "#64748b", dashStyle: "Dot",  width: 1.5, zIndex: 2, label: { text: `LSL (${refSpec.min})`, align: "right", x: -8, y: 12,  style: { color: "#64748b", fontSize: "10px" } } });
    if (visible.mean && ncLim.sigma > 0) plotLines.push({ value: ncLim.mean, color: "#93c5fd", width: 1.5, dashStyle: "Dash", zIndex: 3, label: { text: `NC μ (${ncLim.mean.toFixed(refSpec.decimals)})`, align: "right", x: -8, y: -4, style: { color: "#93c5fd", fontSize: "10px" } } });
    if (visible.mean && chLim.sigma > 0) plotLines.push({ value: chLim.mean, color: "#6ee7b7", width: 1.5, dashStyle: "Dash", zIndex: 3, label: { text: `CH μ (${chLim.mean.toFixed(refSpec.decimals)})`, align: "right", x: -8, y: 12, style: { color: "#6ee7b7", fontSize: "10px" } } });
    if (visible.ucl && isFinite(ncLim.ucl) && ncLim.sigma > 0) plotLines.push({ value: ncLim.ucl, color: "#ef4444", dashStyle: "Dash", width: 1, zIndex: 3, label: { text: `UCL (${ncLim.ucl.toFixed(refSpec.decimals)})`, align: "right", x: -8, y: -4, style: { color: "#ef4444", fontSize: "10px" } } });
    if (visible.lcl && isFinite(ncLim.lcl) && ncLim.sigma > 0) plotLines.push({ value: ncLim.lcl, color: "#ef4444", dashStyle: "Dash", width: 1, zIndex: 3, label: { text: `LCL (${ncLim.lcl.toFixed(refSpec.decimals)})`, align: "right", x: -8, y: 12,  style: { color: "#ef4444", fontSize: "10px" } } });

    const seriesList: any[] = [];
    if (ncSeries.length) {
      seriesList.push({
        type: "line", name: "Non-Chlorinated",
        data: ncSeries.map((s) => ({ x: s.ts, y: s.v, color: (s.v < refSpec.min || s.v > refSpec.max) ? "#ef4444" : "#3b82f6" })),
        color: "#3b82f6", lineWidth: 1.5, marker: { enabled: true, radius: 3, symbol: "circle" },
      });
    }
    if (chSeries.length) {
      seriesList.push({
        type: "line", name: "Chlorinated",
        data: chSeries.map((s) => ({ x: s.ts, y: s.v, color: (s.v < refSpec.min || s.v > refSpec.max) ? "#ef4444" : "#10b981" })),
        color: "#10b981", lineWidth: 1.5, marker: { enabled: true, radius: 3, symbol: "circle" },
      });
    }
    if (!seriesList.length) return null;
    return {
      chart: { type: "line", height: 380, spacing: [16, 90, 16, 10], zooming: { type: "x" } },
      title: { text: undefined }, credits: { enabled: false },
      legend: { enabled: true, itemStyle: { fontSize: "11px", fontWeight: "500", color: "#334155" } },
      xAxis: { type: "datetime", labels: { style: { color: "#64748b", fontSize: "10px" } }, gridLineWidth: 0 },
      yAxis: { title: { text: `${selectedKpi}${refSpec.unit ? ` (${refSpec.unit})` : ""}`, style: { color: "#64748b", fontSize: "11px" } }, plotLines, gridLineColor: "#f1f5f9", labels: { style: { color: "#64748b", fontSize: "10px" } } },
      tooltip: {
        shared: true, useHTML: true,
        backgroundColor: "#1e293b", borderWidth: 0, borderRadius: 6,
        style: { color: "#f8fafc", fontSize: "12px" },
        formatter: function (this: any) {
          let html = `<div style="opacity:0.7;font-size:11px;margin-bottom:4px">${fmtDateTimeIST(this.x)}</div>`;
          (this.points ?? []).forEach((pt: any) => {
            const sp = pt.series.name === "Non-Chlorinated" ? ncSpec : chSpec;
            const inSp = sp ? (pt.y >= sp.min && pt.y <= sp.max) : true;
            html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="color:${pt.color}">●</span><span style="font-weight:600">${pt.series.name}:</span><span style="color:${inSp ? "#86efac" : "#fca5a5"}">${pt.y.toFixed(sp?.decimals ?? 2)} ${sp?.unit ?? ""}</span></div>`;
          });
          return html;
        },
      },
      plotOptions: { line: { connectNulls: false } },
      series: seriesList,
    };
  }, [ncSpec, chSpec, ncSeries, chSeries, selectedKpi, visible, ncLim, chLim, refSpec]);

  // Comparison table
  const compRows = useMemo(() =>
    kpiLabels.map((label) => {
      const ncP = ncParams.find((p) => p.label === label);
      const chP = chParams.find((p) => p.label === label);
      const ncVs = ncP ? seriesFor(filteredReadings, ncP.key as any).map((s) => s.v) : [];
      const chVs = chP ? seriesFor(filteredReadings, chP.key as any).map((s) => s.v) : [];
      const ncC = ncP ? capability(ncVs, ncP.min, ncP.max) : null;
      const chC = chP ? capability(chVs, chP.min, chP.max) : null;
      const delta = ncC?.cpk !== null && chC?.cpk !== null && ncC && chC ? ncC.cpk! - chC.cpk! : null;
      return { label, ncN: ncVs.length, chN: chVs.length, ncC, chC, delta };
    }),
  [kpiLabels, ncParams, chParams, filteredReadings]);

  const ncOos = ncSeries.filter((s) => refSpec && (s.v < refSpec.min || s.v > refSpec.max)).length;
  const chOos = chSeries.filter((s) => refSpec && (s.v < refSpec.min || s.v > refSpec.max)).length;

  const fmt = refSpec ? (n: number) => n.toFixed(refSpec.decimals) : (n: number) => n.toFixed(2);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      {/* ① Header */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium">{waterLabel} · Six Sigma Analysis</div>
        <div className="text-[22px] font-medium tracking-tight mt-0.5">Process Control · NC vs Chlorinated · {range.label}</div>
      </div>

      {/* ② KPI pills */}
      <KpiPills labels={kpiLabels} selected={selectedKpi} onSelect={setSelectedKpi} />

      {/* ③ Stats card — NC | CH side by side */}
      <div className="card px-5 py-4 mb-4">
        <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium mb-4">Statistics · {selectedKpi}</div>
        <div className="grid grid-cols-2 gap-6">
          {lineInfo.map(({ key, cat, spec, cap, lim, series, color }) => {
            const rc = ratingColor(cap.rating);
            return (
              <div key={key} style={{ borderTop: `3px solid ${color}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 10 }}>{cat}</div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <Tile label="n"        value={String(series.length)} />
                  <Tile label="μ (Mean)" value={series.length ? fmt(lim.mean) : "—"} unit={spec?.unit} />
                  <Tile label="σ"        value={lim.sigma > 0 ? fmt(lim.sigma) : "—"} />
                  <Tile
                    label="Cpk"
                    value={cap.cpk !== null ? cap.cpk.toFixed(2) : "—"}
                    tone={cap.cpk !== null && cap.cpk < 1 ? "breach" : cap.cpk !== null && cap.cpk < 1.33 ? "warn" : undefined}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, border: `1px solid ${rc.border}`, background: rc.bg, color: rc.fg }}>{cap.rating}</span>
                  {cap.cp !== null && <span style={{ fontSize: 11, color: "var(--ink-2)" }}>Cp {cap.cp.toFixed(2)}</span>}
                  {lim.sigma > 0 && <span style={{ fontSize: 11, color: "var(--ink-2)" }}>UCL {fmt(lim.ucl)} · LCL {fmt(lim.lcl)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ④ Chart card */}
      <div className="card px-5 py-4 mb-4">
        <div className="flex items-center flex-wrap gap-4 mb-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium flex-1">
            Individual Values · {selectedKpi} · NC vs Chlorinated
          </div>
          <div className="flex items-center gap-2">
            <LineToggle label="Mean"  color="#10b981" solid   active={visible.mean} onClick={() => toggleLine("mean")} />
            <LineToggle label="UCL"   color="#ef4444" dashed  active={visible.ucl}  onClick={() => toggleLine("ucl")} title="UCL from Non-Chlorinated line" />
            <LineToggle label="LCL"   color="#ef4444" dashed  active={visible.lcl}  onClick={() => toggleLine("lcl")} title="LCL from Non-Chlorinated line" />
            <LineToggle label="USL"   color="#64748b" dotted  active={visible.usl}  onClick={() => toggleLine("usl")} />
            <LineToggle label="LSL"   color="#64748b" dotted  active={visible.lsl}  onClick={() => toggleLine("lsl")} />
          </div>
          <div className="flex items-center gap-3">
            <DotPill color="#3b82f6" label="Non-Chlorinated" />
            <DotPill color="#10b981" label="Chlorinated" />
            <DotPill color="#ef4444" label="Out of Spec" />
          </div>
        </div>
        {dualChart ? <Chart options={dualChart} /> : <EmptyChart message={`No data for ${selectedKpi} in ${range.label}`} height={380} />}
        <div className="flex items-center gap-2 mt-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">Out of spec</div>
          {[{ label: "NC", oos: ncOos, n: ncSeries.length, color: "#3b82f6" }, { label: "CH", oos: chOos, n: chSeries.length, color: "#10b981" }].map(({ label, oos, n, color }) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 12, background: `color-mix(in srgb, ${color} 10%, white)`, border: `1px solid ${color}`, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              <span style={{ fontWeight: 600, color }}>{label}</span>
              <span className="tnum" style={{ color: oos > 0 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>{oos}/{n}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ⑤ Table card */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--hairline)]">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">Capability Comparison · All Parameters</div>
        </div>
        <table className="w-full text-[12px] tnum">
          <thead className="bg-[var(--bg)]">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-[var(--ink-2)]" style={{ width: 150 }}>Parameter</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: "#3b82f6" }}>NC n</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: "#3b82f6" }}>NC Cpk</th>
              <th className="text-left  px-2 py-2 font-medium" style={{ color: "#3b82f6", width: 90 }}>NC Rating</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: "#10b981" }}>CH n</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: "#10b981" }}>CH Cpk</th>
              <th className="text-left  px-2 py-2 font-medium" style={{ color: "#10b981", width: 90 }}>CH Rating</th>
              <th className="text-right px-3 py-2 font-medium text-[var(--ink-2)]">Δ Cpk</th>
            </tr>
          </thead>
          <tbody>
            {compRows.map(({ label, ncN, chN, ncC, chC, delta }) => {
              const ncRc = ncC ? ratingColor(ncC.rating) : ratingColor("Insufficient Data");
              const chRc = chC ? ratingColor(chC.rating) : ratingColor("Insufficient Data");
              const isSelected = selectedKpi === label;
              return (
                <tr key={label} className="border-t border-[var(--hairline)] cursor-pointer hover:bg-[var(--bg)]" style={{ background: isSelected ? "#eff6ff" : undefined }} onClick={() => setSelectedKpi(label)}>
                  <td className="px-4 py-2 font-medium" style={{ color: "#1e293b" }}>{isSelected && <span style={{ color: "#2563eb", marginRight: 6 }}>▸</span>}{label}</td>
                  <td className="text-right px-3 py-2 text-[var(--ink-2)]">{ncN}</td>
                  <td className="text-right px-3 py-2" style={{ fontWeight: 600, color: ncC?.cpk !== null && ncC!.cpk! < 1 ? "var(--breach)" : ncC?.cpk !== null && ncC!.cpk! < 1.33 ? "var(--warn)" : "#1e293b" }}>{ncC?.cpk !== null ? ncC!.cpk!.toFixed(2) : "—"}</td>
                  <td className="px-2 py-2"><span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 8, border: `1px solid ${ncRc.border}`, background: ncRc.bg, color: ncRc.fg, whiteSpace: "nowrap" }}>{ncC?.rating ?? "—"}</span></td>
                  <td className="text-right px-3 py-2 text-[var(--ink-2)]">{chN}</td>
                  <td className="text-right px-3 py-2" style={{ fontWeight: 600, color: chC?.cpk !== null && chC!.cpk! < 1 ? "var(--breach)" : chC?.cpk !== null && chC!.cpk! < 1.33 ? "var(--warn)" : "#1e293b" }}>{chC?.cpk !== null ? chC!.cpk!.toFixed(2) : "—"}</td>
                  <td className="px-2 py-2"><span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 8, border: `1px solid ${chRc.border}`, background: chRc.bg, color: chRc.fg, whiteSpace: "nowrap" }}>{chC?.rating ?? "—"}</span></td>
                  <td className="text-right px-3 py-2" style={{ fontWeight: 700, color: delta !== null ? (delta > 0.1 ? "#10b981" : delta < -0.1 ? "#ef4444" : "#64748b") : "#94a3b8" }}>{delta !== null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TREATED WATER ────────────────────────────────────────────────────────────

function TreatedWaterAnalysis({ params, filteredReadings, range, onSelectParam, waterLabel }: TreatedProps) {
  const kpiLabels = params.map((p) => p.label);
  const [selectedKey, setSelectedKey] = useState<string>(params[0]?.key ?? "");
  const [visible, setVisible] = useState<Record<LineKey, boolean>>(DEFAULT_VISIBLE);
  const toggleLine = (k: LineKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  useEffect(() => {
    if (!params.some((p) => p.key === selectedKey)) setSelectedKey(params[0]?.key ?? "");
  }, [params, selectedKey]);

  const selectedLabel = params.find((p) => p.key === selectedKey)?.label ?? kpiLabels[0] ?? "";

  const spec = params.find((p) => p.key === selectedKey);
  const series = spec ? seriesFor(filteredReadings, spec.key as any) : [];
  const values = series.map((s) => s.v);
  const autoLim = controlLimits(values);
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
    for (const v of values) c[zoneFor(v, autoLim.mean, autoLim.sigma, spec.min, spec.max, effectiveUcl, effectiveLcl)]++;
    return c;
  }, [values, autoLim, spec, effectiveUcl, effectiveLcl]);

  const summary = useMemo(() =>
    params.map((p) => {
      const s = seriesFor(filteredReadings, p.key as any);
      const vs = s.map((x) => x.v);
      return { p, n: vs.length, l: controlLimits(vs), c: capability(vs, p.min, p.max) };
    }),
  [params, filteredReadings]);

  const fmt = spec ? (n: number) => n.toFixed(spec.decimals) : (n: number) => n.toFixed(2);
  const chartOptions = spec && series.length ? buildTreatedChartOptions(spec, series, autoLim, lim, fmt, visible) : null;

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      {/* ① Header */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium">{waterLabel ? `${waterLabel} · ` : ""}Six Sigma Analysis</div>
        <div className="text-[22px] font-medium tracking-tight mt-0.5">I-MR Control Chart · {range.label}</div>
      </div>

      {/* ② KPI pills */}
      <KpiPills
        labels={kpiLabels}
        selected={selectedLabel}
        onSelect={(label) => setSelectedKey(params.find((p) => p.label === label)?.key ?? selectedKey)}
      />

      {/* ③ Stats card */}
      <div className="card px-5 py-4 mb-4">
        <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium mb-3">Statistics · {spec?.label ?? "—"}</div>
        <div className="grid grid-cols-8 gap-2">
          <Tile label="n"                                                                  value={String(values.length)} />
          <Tile label="μ (Mean)"                                                           value={values.length ? fmt(lim.mean) : "—"}          unit={spec?.unit} />
          <Tile label="σ (Stddev)"                                                         value={lim.sigma > 0 ? fmt(lim.sigma) : "—"}          unit={spec?.unit} />
          <Tile label={`UCL${usingUclOverride ? " · manual" : ""}`}                       value={isFinite(lim.ucl) ? fmt(lim.ucl) : "—"}        unit={spec?.unit} />
          <Tile label={`LCL${usingLclOverride ? " · manual" : ""}`}                       value={isFinite(lim.lcl) ? fmt(lim.lcl) : "—"}        unit={spec?.unit} />
          <Tile label="Cp"  value={cap.cp  !== null ? cap.cp.toFixed(2)  : "—"}  tone={cap.cp  !== null && cap.cp  < 1 ? "breach" : undefined} />
          <Tile label="Cpk" value={cap.cpk !== null ? cap.cpk.toFixed(2) : "—"}  tone={cap.cpk !== null && cap.cpk < 1 ? "breach" : cap.cpk !== null && cap.cpk < 1.33 ? "warn" : undefined} />
          <RatingTile rating={cap.rating} color={ratingC} />
        </div>
      </div>

      {/* ④ Chart card */}
      <div className="card px-5 py-4 mb-4">
        <div className="flex items-center flex-wrap gap-4 mb-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium flex-1">
            Individual Values · {spec?.label ?? "—"}
          </div>
          <div className="flex items-center gap-2">
            <LineToggle label="Mean"                              color="#10b981" solid   active={visible.mean} onClick={() => toggleLine("mean")} />
            <LineToggle label={`UCL${usingUclOverride ? " *" : ""}`} color="#ef4444" dashed  active={visible.ucl}  onClick={() => toggleLine("ucl")}  title={usingUclOverride ? "Manual UCL (from Settings)" : "UCL = μ + 3σ (auto)"} />
            <LineToggle label={`LCL${usingLclOverride ? " *" : ""}`} color="#ef4444" dashed  active={visible.lcl}  onClick={() => toggleLine("lcl")}  title={usingLclOverride ? "Manual LCL (from Settings)" : "LCL = μ − 3σ (auto)"} />
            <LineToggle label="USL"                              color="#64748b" dotted  active={visible.usl}  onClick={() => toggleLine("usl")} />
            <LineToggle label="LSL"                              color="#64748b" dotted  active={visible.lsl}  onClick={() => toggleLine("lsl")} />
          </div>
          <div className="flex items-center gap-3">
            <DotPill color={ZONE_COLOR.normal}  label="Normal" />
            <DotPill color={ZONE_COLOR.caution} label="Caution" />
            <DotPill color={ZONE_COLOR.warning} label="Warning" />
            <DotPill color={ZONE_COLOR.ooc}     label="Out of Control" />
          </div>
        </div>
        {chartOptions ? <Chart options={chartOptions} /> : <EmptyChart message={values.length === 0 ? `No samples for ${spec?.label ?? "this parameter"} in ${range.label}` : "Select a parameter"} height={420} />}
        <div className="flex items-center gap-2 mt-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">Sample distribution</div>
          <ZoneCount label="Normal"         count={zoneCounts.normal}  color={ZONE_COLOR.normal}  />
          <ZoneCount label="Caution"        count={zoneCounts.caution} color={ZONE_COLOR.caution} />
          <ZoneCount label="Warning"        count={zoneCounts.warning} color={ZONE_COLOR.warning} />
          <ZoneCount label="Out of Control" count={zoneCounts.ooc}     color={ZONE_COLOR.ooc}     />
          {spec && <button onClick={() => onSelectParam(spec.key)} className="ml-auto text-[11px] text-[#1d4ed8] hover:underline">Open full drill-in →</button>}
        </div>
      </div>

      {/* ⑤ Table card */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--hairline)] text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium">
          Capability · All Parameters
        </div>
        <table className="w-full text-[12px] tnum">
          <thead className="bg-[var(--bg)] text-[var(--ink-2)]">
            <tr>
              <th className="text-left  px-4 py-2 font-medium" style={{ width: 180 }}>Parameter</th>
              <th className="text-right px-3 py-2 font-medium">n</th>
              <th className="text-right px-3 py-2 font-medium">μ</th>
              <th className="text-right px-3 py-2 font-medium">σ</th>
              <th className="text-right px-3 py-2 font-medium">UCL</th>
              <th className="text-right px-3 py-2 font-medium">LCL</th>
              <th className="text-right px-3 py-2 font-medium">Cp</th>
              <th className="text-right px-3 py-2 font-medium">Cpk</th>
              <th className="text-left  px-3 py-2 font-medium" style={{ width: 130 }}>Rating</th>
            </tr>
          </thead>
          <tbody>
            {summary.map(({ p, n, l, c }) => {
              const rc = ratingColor(c.rating);
              const f  = (x: number) => x.toFixed(p.decimals);
              const isSelected = p.key === selectedKey;
              return (
                <tr key={p.key} className="border-t border-[var(--hairline)] cursor-pointer hover:bg-[var(--bg)]" style={{ background: isSelected ? "#eff6ff" : undefined }} onClick={() => setSelectedKey(p.key)}>
                  <td className="px-4 py-2 font-medium" style={{ color: "#1e293b" }}>{isSelected && <span style={{ color: "#2563eb", marginRight: 6 }}>▸</span>}{p.label}</td>
                  <td className="text-right px-3 py-2">{n}</td>
                  <td className="text-right px-3 py-2">{n ? f(l.mean) : "—"}</td>
                  <td className="text-right px-3 py-2">{l.sigma > 0 ? f(l.sigma) : "—"}</td>
                  <td className="text-right px-3 py-2">{l.sigma > 0 ? f(l.ucl) : "—"}</td>
                  <td className="text-right px-3 py-2">{l.sigma > 0 ? f(l.lcl) : "—"}</td>
                  <td className="text-right px-3 py-2" style={{ color: c.cp !== null && c.cp < 1 ? "var(--breach)" : undefined }}>{c.cp !== null ? c.cp.toFixed(2) : "—"}</td>
                  <td className="text-right px-3 py-2" style={{ fontWeight: 600, color: c.cpk !== null && c.cpk < 1 ? "var(--breach)" : c.cpk !== null && c.cpk < 1.33 ? "var(--warn)" : undefined }}>{c.cpk !== null ? c.cpk.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2"><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, border: `1px solid ${rc.border}`, background: rc.bg, color: rc.fg, whiteSpace: "nowrap" }}>{c.rating}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Chart builder for Treated Water ─────────────────────────────────────────

function buildTreatedChartOptions(
  spec: ParamSpec,
  series: { ts: number; v: number }[],
  autoLim: { mean: number; sigma: number; ucl: number; lcl: number },
  lim: { mean: number; sigma: number; ucl: number; lcl: number },
  fmt: (n: number) => string,
  visible: Record<LineKey, boolean>
) {
  const points = series.map((s) => {
    const zone = zoneFor(s.v, autoLim.mean, autoLim.sigma, spec.min, spec.max, lim.ucl, lim.lcl);
    return { x: s.ts, y: s.v, color: ZONE_COLOR[zone], marker: { fillColor: ZONE_COLOR[zone], lineColor: ZONE_COLOR[zone], radius: 4 }, zone };
  });
  const plotLines: any[] = [];
  if (visible.mean && autoLim.sigma > 0) plotLines.push({ value: lim.mean, color: "#10b981", width: 2, zIndex: 3, label: { text: `Mean (${fmt(lim.mean)})`, align: "right", x: -8, y: -4, style: { color: "#10b981", fontSize: "10px", fontWeight: "500" } } });
  if (visible.ucl  && isFinite(lim.ucl)) plotLines.push({ value: lim.ucl, color: "#ef4444", dashStyle: "Dash", width: 1, zIndex: 3, label: { text: `UCL (${fmt(lim.ucl)})`, align: "right", x: -8, y: -4, style: { color: "#ef4444", fontSize: "10px" } } });
  if (visible.lcl  && isFinite(lim.lcl)) plotLines.push({ value: lim.lcl, color: "#ef4444", dashStyle: "Dash", width: 1, zIndex: 3, label: { text: `LCL (${fmt(lim.lcl)})`, align: "right", x: -8, y: 12,  style: { color: "#ef4444", fontSize: "10px" } } });
  if (visible.usl)                        plotLines.push({ value: spec.max, color: "#64748b", dashStyle: "Dot", width: 1, zIndex: 2, label: { text: `USL (${spec.max})`, align: "right", x: -8, y: -4, style: { color: "#64748b", fontSize: "10px" } } });
  if (visible.lsl)                        plotLines.push({ value: spec.min, color: "#64748b", dashStyle: "Dot", width: 1, zIndex: 2, label: { text: `LSL (${spec.min})`, align: "right", x: -8, y: 12,  style: { color: "#64748b", fontSize: "10px" } } });
  const allY = [...series.map((s) => s.v), spec.min, spec.max, ...(isFinite(lim.ucl) ? [lim.ucl] : []), ...(isFinite(lim.lcl) ? [lim.lcl] : [])];
  const pad = ((Math.max(...allY) - Math.min(...allY)) * 0.08) || 1;
  return {
    chart: { type: "line", height: 440, spacing: [20, 90, 20, 10], zooming: { type: "x" } },
    title: { text: undefined }, legend: { enabled: false }, credits: { enabled: false },
    xAxis: { type: "datetime", labels: { style: { color: "#64748b", fontSize: "10px" } }, gridLineWidth: 0 },
    yAxis: { title: { text: `${spec.label} (${spec.unit})`, style: { color: "#64748b", fontSize: "11px" } }, min: Math.min(...allY) - pad, max: Math.max(...allY) + pad, plotLines, gridLineColor: "#f1f5f9", labels: { style: { color: "#64748b", fontSize: "10px" } } },
    tooltip: {
      useHTML: true, backgroundColor: "#1e293b", borderWidth: 0, borderRadius: 6, padding: 10,
      style: { color: "#f8fafc", fontSize: "12px" },
      formatter: function (this: any) {
        const z = (this.point as any).zone as Zone;
        const zLabel = z === "normal" ? "Normal" : z === "caution" ? "Caution" : z === "warning" ? "Warning" : "Out of Control";
        return `<div style="opacity:0.7;font-size:11px">${fmtDateTimeIST(this.x)}</div>
          <div style="font-size:13px;font-weight:500">Value: ${fmt(this.y)} ${spec.unit}</div>
          <div style="font-size:11px;color:${ZONE_COLOR[z]}">Status: <b>${zLabel}</b></div>`;
      },
    },
    plotOptions: { line: { lineWidth: 1.5, color: "#93c5fd", marker: { enabled: true, symbol: "circle" }, states: { hover: { lineWidthPlus: 0 } } } },
    series: [{ type: "line", name: spec.label, data: points }],
  };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function EmptyChart({ message, height }: { message: string; height: number }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)", fontSize: 13, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
      {message}
    </div>
  );
}

function LineToggle({ color, label, solid, dashed, dotted, active, onClick, title }: { color: string; label: string; solid?: boolean; dashed?: boolean; dotted?: boolean; active: boolean; onClick: () => void; title?: string }) {
  const style = solid ? "solid" : dashed ? "dashed" : dotted ? "dotted" : "solid";
  return (
    <button type="button" onClick={onClick} title={title ?? (active ? `Hide ${label}` : `Show ${label}`)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", border: `1px solid ${active ? color : "#e2e8f0"}`, borderRadius: 12, background: active ? `color-mix(in srgb, ${color} 10%, white)` : "white", color: active ? color : "#94a3b8", fontSize: 11, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s" }}>
      <span style={{ width: 14, borderTop: `2px ${style} ${active ? color : "#cbd5e1"}`, display: "inline-block" }} />
      {label}
    </button>
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
  const color = tone === "breach" ? "var(--breach)" : tone === "warn" ? "var(--warn)" : undefined;
  return (
    <div style={{ padding: "8px 10px", border: "1px solid var(--hairline)", borderRadius: 8, background: "white" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)", fontWeight: 500 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 15, fontWeight: 600, marginTop: 2, color }}>
        {value}{unit && value !== "—" && <span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-2)", marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function RatingTile({ rating, color }: { rating: string; color: { fg: string; bg: string; border: string } }) {
  return (
    <div style={{ padding: "8px 10px", border: `1px solid ${color.border}`, borderRadius: 8, background: color.bg }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)", fontWeight: 500 }}>Rating</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: color.fg }}>{rating}</div>
    </div>
  );
}

function ZoneCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 12, background: `color-mix(in srgb, ${color} 10%, white)`, border: `1px solid ${color}`, fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span className="tnum" style={{ fontWeight: 600, color }}>{count}</span>
      <span style={{ color: "var(--ink-2)" }}>{label}</span>
    </span>
  );
}
