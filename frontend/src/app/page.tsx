"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { DEFAULT_PARAMS, DEFAULT_SETTINGS, ParamSpec } from "../lib/config";
import { Reading, NOW_TS } from "../lib/mockData";
import { Header } from "../components/Header";
import { RealtimeView } from "../components/RealtimeView";
import { FormView } from "../components/FormView";
import { SettingsSheet } from "../components/SettingsSheet";
import { ParamDetailDrawer } from "../components/ParamDetailDrawer";
import { DEFAULT_RANGE, TimeRange } from "../components/TimePicker";
import { exchangeSSOToken } from "../lib/iosense/auth";
import {
  DEVICE_ID,
  SensorMap,
  autoMapSensors,
  fetchDeviceMeta,
  fetchReadings,
} from "../lib/iosense/dataService";

type View = "realtime" | "form";
const DAY_MS = 24 * 3600 * 1000;

export default function Page() {
  const [view, setView] = useState<View>("realtime");
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drillKey, setDrillKey] = useState<string | null>(null);
  const [params, setParams] = useState<ParamSpec[]>(DEFAULT_PARAMS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // IOsense state
  const [sensorMap, setSensorMap] = useState<SensorMap>({});
  const [readings, setReadings] = useState<Reading[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Step 1: Auth + device metadata on mount
  useEffect(() => {
    async function init() {
      try {
        const auth = await exchangeSSOToken();
        if (!auth) return;
        const meta = await fetchDeviceMeta(DEVICE_ID);
        const map = autoMapSensors(meta.sensors);
        setSensorMap(map);
      } catch (err) {
        console.error("Init error:", err);
      }
    }
    init();
  }, []);

  // Step 2: Fetch all rows once after sensorMap is ready.
  // Views filter client-side so the Overview can be locked to 7d while
  // the QC Log and drawer honour their own ranges.
  const loadData = useCallback(async () => {
    if (Object.keys(sensorMap).length === 0) return;
    setDataLoading(true);
    try {
      const data = await fetchReadings(sensorMap);
      setReadings(data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setDataLoading(false);
    }
  }, [sensorMap]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // QC Log honours the top-level time picker
  const filteredReadings = useMemo(
    () => readings.filter((r) => r.ts >= timeRange.startTs && r.ts <= timeRange.endTs),
    [readings, timeRange]
  );

  // Overview cards are always the last 7 days ending now
  const last7Readings = useMemo(() => {
    const end = NOW_TS;
    const start = end - 7 * DAY_MS;
    return readings.filter((r) => r.ts >= start && r.ts <= end);
  }, [readings]);

  const customized = useMemo(
    () =>
      JSON.stringify(params) !== JSON.stringify(DEFAULT_PARAMS) ||
      JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS),
    [params, settings]
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <Header
        view={view}
        onView={setView}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        onOpenSettings={() => setSettingsOpen(true)}
        customized={customized}
      />

      {dataLoading && (
        <div style={{ position: "fixed", top: 64, right: 20, zIndex: 50, background: "#1e293b", color: "#fff", fontSize: 12, padding: "5px 12px", borderRadius: 20, opacity: 0.8 }}>
          Loading…
        </div>
      )}

      <main style={{ flex: 1 }}>
        {view === "realtime" && (
          <RealtimeView
            params={params}
            readings={last7Readings}
            bufferPct={settings.warningBufferPct}
            driftWindow={settings.driftWindowN}
            driftProject={settings.driftProjectionM}
            onSelectParam={setDrillKey}
          />
        )}
        {view === "form" && (
          <FormView
            params={params}
            readings={filteredReadings}
            timeRange={timeRange}
            bufferPct={settings.warningBufferPct}
            onSelectParam={setDrillKey}
          />
        )}
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        params={params}
        settings={settings}
        onSave={(p, s) => {
          setParams(p);
          setSettings(s);
          setSettingsOpen(false);
        }}
      />
      <ParamDetailDrawer
        paramKey={drillKey}
        params={params}
        readings={readings}
        onClose={() => setDrillKey(null)}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
