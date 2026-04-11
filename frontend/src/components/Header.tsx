"use client";

import { TimePicker, TimeRange } from "./TimePicker";

type View = "realtime" | "form";

interface Props {
  view: View;
  onView: (v: View) => void;
  timeRange: TimeRange;
  onTimeRange: (r: TimeRange) => void;
  onOpenSettings: () => void;
  customized: boolean;
}

const TABS: { key: View; label: string }[] = [
  { key: "realtime", label: "Overview" },
  { key: "form",     label: "QC Log" },
];

export function Header({ view, onView, timeRange, onTimeRange, onOpenSettings, customized }: Props) {
  return (
    <header style={{ borderBottom: "1px solid #e2e8f0", background: "white", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Left: logo + nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 500 }}>Moon Beverages</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 1 }}>Treated Water Quality</div>
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

        {/* Right: time picker (QC Log only) + settings + live dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view === "form" && <TimePicker value={timeRange} onChange={onTimeRange} />}
          <button
            onClick={onOpenSettings}
            title="Settings"
            style={{
              position: "relative",
              padding: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {customized && (
              <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
            )}
          </button>
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
