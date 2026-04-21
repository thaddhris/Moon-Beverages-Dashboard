"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { DEFAULT_PARAMS, DEFAULT_SETTINGS, ParamSpec } from "../lib/config";
import { Reading, NOW_TS } from "../lib/mockData";
import { Header } from "../components/Header";
import { WaterTypeBar } from "../components/WaterTypeBar";
import { RealtimeView } from "../components/RealtimeView";
import { FormView } from "../components/FormView";
import { AnalysisView } from "../components/AnalysisView";
import { SettingsSheet } from "../components/SettingsSheet";
import { ParamDetailDrawer } from "../components/ParamDetailDrawer";
import { DEFAULT_RANGE, TimeRange, computePreset } from "../components/TimePicker";
import { exchangeSSOToken } from "../lib/iosense/auth";
import {
  SensorMap,
  autoMapSensors,
  fetchDeviceMeta,
  fetchReadings,
} from "../lib/iosense/dataService";
import { WaterType, configFor, WATER_TYPES } from "../lib/waterTypes";

type View = "realtime" | "form" | "analysis";
type AppSettings = typeof DEFAULT_SETTINGS;

function initialPerType<T>(value: () => T): Record<WaterType, T> {
  return WATER_TYPES.reduce((acc, w) => {
    acc[w.key] = value();
    return acc;
  }, {} as Record<WaterType, T>);
}

export default function Page() {
  const [waterType, setWaterType] = useState<WaterType>("treated");
  const [view, setView] = useState<View>("realtime");
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [overviewRange, setOverviewRange] = useState<TimeRange>(() => computePreset("today", NOW_TS));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drillKey, setDrillKey] = useState<string | null>(null);

  // Per-water-type customisation — each tab keeps its own params & settings.
  const [paramsByType, setParamsByType] = useState<Record<WaterType, ParamSpec[]>>(
    () => initialPerType(() => [...DEFAULT_PARAMS])
  );
  const [settingsByType, setSettingsByType] = useState<Record<WaterType, AppSettings>>(
    () => initialPerType(() => ({ ...DEFAULT_SETTINGS }))
  );

  // Per-water-type data
  const [sensorMap, setSensorMap] = useState<SensorMap>({});
  const [readingsByType, setReadingsByType] = useState<Record<WaterType, Reading[]>>(
    () => initialPerType<Reading[]>(() => [])
  );
  const [dataLoading, setDataLoading] = useState(false);

  const currentConfig = configFor(waterType);
  const params = paramsByType[waterType];
  const settings = settingsByType[waterType];
  const readings = readingsByType[waterType];

  useEffect(() => {
    async function init() {
      try {
        const auth = await exchangeSSOToken();
        if (!auth) return;
        const meta = await fetchDeviceMeta(currentConfig.deviceId);
        const map = autoMapSensors(meta.sensors);
        setSensorMap(map);
      } catch (err) {
        console.error("Init error:", err);
      }
    }
    init();
  }, [currentConfig.deviceId]);

  const loadData = useCallback(async () => {
    if (Object.keys(sensorMap).length === 0) return;
    setDataLoading(true);
    try {
      const data = await fetchReadings(sensorMap, currentConfig.deviceId);
      setReadingsByType((prev) => ({ ...prev, [waterType]: data }));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setDataLoading(false);
    }
  }, [sensorMap, currentConfig.deviceId, waterType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => { setDrillKey(null); }, [waterType]);

  const filteredReadings = useMemo(
    () => readings.filter((r) => r.ts >= timeRange.startTs && r.ts <= timeRange.endTs),
    [readings, timeRange]
  );

  const overviewReadings = useMemo(
    () => readings.filter((r) => r.ts >= overviewRange.startTs && r.ts <= overviewRange.endTs),
    [readings, overviewRange]
  );

  // Customisation badge: true if THIS tab's settings differ from defaults
  const customized = useMemo(
    () =>
      JSON.stringify(params) !== JSON.stringify(DEFAULT_PARAMS) ||
      JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS),
    [params, settings]
  );

  const saveSettings = (p: ParamSpec[], s: AppSettings) => {
    setParamsByType((prev) => ({ ...prev, [waterType]: p }));
    setSettingsByType((prev) => ({ ...prev, [waterType]: s }));
    setSettingsOpen(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <Header
        view={view}
        onView={setView}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
      />

      <WaterTypeBar
        value={waterType}
        onChange={setWaterType}
        subtitle={currentConfig.subtitle}
        onOpenSettings={() => setSettingsOpen(true)}
        customized={customized}
      />

      {dataLoading && (
        <div style={{ position: "fixed", top: 70, right: 20, zIndex: 50, background: "#1e293b", color: "#fff", fontSize: 12, padding: "5px 12px", borderRadius: 20, opacity: 0.8 }}>
          Loading…
        </div>
      )}

      <main style={{ flex: 1 }}>
        {view === "realtime" && (
          <RealtimeView
            params={params}
            readings={overviewReadings}
            range={overviewRange}
            onRangeChange={setOverviewRange}
            bufferPct={settings.warningBufferPct}
            driftWindow={settings.driftWindowN}
            driftProject={settings.driftProjectionM}
            onSelectParam={setDrillKey}
            waterLabel={currentConfig.label}
          />
        )}
        {view === "form" && (
          <FormView
            params={params}
            readings={filteredReadings}
            timeRange={timeRange}
            bufferPct={settings.warningBufferPct}
            onSelectParam={setDrillKey}
            waterLabel={currentConfig.label}
            waterSubtitle={currentConfig.subtitle}
          />
        )}
        {view === "analysis" && (
          <AnalysisView
            params={params}
            readings={readings}
            range={overviewRange}
            onRangeChange={setOverviewRange}
            onSelectParam={setDrillKey}
            waterLabel={currentConfig.label}
          />
        )}
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        waterLabel={currentConfig.label}
        params={params}
        settings={settings}
        onSave={saveSettings}
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
