"use client";

import { useState } from "react";
import { Device } from "../lib/iosense/devices";

interface Props {
  devices: Device[];
  onClose: () => void;
}

export function DeviceDiscovery({ devices, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: 680, maxHeight: "80vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Devices on your account</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{devices.length} device{devices.length !== 1 ? "s" : ""} found</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {devices.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              No devices found on this account.
            </div>
          )}
          {devices.map((d) => (
            <div key={d.devID} style={{ marginBottom: 8, borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <button
                onClick={() => setExpanded(expanded === d.devID ? null : d.devID)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", background: expanded === d.devID ? "#f8fafc" : "#fff",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{d.devName || d.devID}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    ID: <code style={{ fontFamily: "monospace", background: "#f1f5f9", padding: "1px 5px", borderRadius: 3 }}>{d.devID}</code>
                    {" · "}{d.devTypeName || d.devTypeID}
                    {d.tags?.length > 0 && <> · {d.tags.join(", ")}</>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{d.sensors?.length ?? 0} sensors</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ transform: expanded === d.devID ? "rotate(180deg)" : "none", transition: "0.15s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {expanded === d.devID && (
                <div style={{ padding: "4px 16px 12px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Sensor ID</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Sensor Name</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.sensors ?? []).map((s) => (
                        <tr key={s.sensorId}>
                          <td style={{ padding: "5px 8px", color: "#0f172a", fontFamily: "monospace" }}>{s.sensorId}</td>
                          <td style={{ padding: "5px 8px", color: "#0f172a" }}>{s.sensorName}</td>
                          <td style={{ padding: "5px 8px", color: "#64748b" }}>{d.unitSelected?.[s.sensorId] ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
          Share the Device IDs and Sensor IDs above to map them to QC parameters.
        </div>
      </div>
    </div>
  );
}
