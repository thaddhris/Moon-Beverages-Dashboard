"use client";

import { WATER_TYPES, WaterType } from "../lib/waterTypes";

interface Props {
  value: WaterType;
  onChange: (w: WaterType) => void;
  subtitle?: string;
  onOpenSettings: () => void;
  customized: boolean;
}

export function WaterTypeBar({ value, onChange, subtitle, onOpenSettings, customized }: Props) {
  return (
    <div
      style={{
        background: "#fafbfc",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "10px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          Water Category
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 3,
            background: "#eef2f7",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        >
          {WATER_TYPES.map((w) => (
            <button
              key={w.key}
              onClick={() => onChange(w.key)}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: value === w.key ? 600 : 500,
                background: value === w.key ? "white" : "transparent",
                color: value === w.key ? "#0f172a" : "#64748b",
                boxShadow: value === w.key ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>
            {subtitle}
          </div>
        )}
        <button
          onClick={onOpenSettings}
          title={`Settings · scoped to ${WATER_TYPES.find((w) => w.key === value)?.label ?? ""}`}
          style={{
            position: "relative",
            marginLeft: subtitle ? 8 : "auto",
            padding: "6px 10px",
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            cursor: "pointer",
            color: "#475569",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
          {customized && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#f59e0b",
                display: "inline-block",
                marginLeft: 2,
              }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
