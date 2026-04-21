"use client";

import { TimePicker, TimeRange } from "./TimePicker";

type View = "realtime" | "form" | "analysis";

interface Props {
  view: View;
  onView: (v: View) => void;
  timeRange: TimeRange;
  onTimeRange: (r: TimeRange) => void;
}

const TABS: { key: View; label: string }[] = [
  { key: "realtime", label: "Overview" },
  { key: "form",     label: "QC Log" },
  { key: "analysis", label: "Six Sigma Analysis" },
];

export function Header({
  view,
  onView,
  timeRange,
  onTimeRange,
}: Props) {
  return (
    <header style={{ borderBottom: "1px solid #e2e8f0", background: "white", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 500 }}>Moon Beverages</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 1 }}>Water Quality Control</div>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => onView(t.key)}
                style={{
                  padding: "5px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: view === t.key ? 600 : 400,
                  background: view === t.key ? "#f1f5f9" : "transparent",
                  color: view === t.key ? "#0f172a" : "#64748b",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view === "form" && <TimePicker value={timeRange} onChange={onTimeRange} />}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8", padding: "4px 8px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
            Live
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </header>
  );
}
