"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { DEFAULT_PARAMS, RAW_WATER_PARAMS, SOFT_WATER_PARAMS, DEFAULT_SETTINGS, ParamSpec } from "../lib/config";
import { Reading, NOW_TS, MOCK_READINGS, RAW_WATER_READINGS, SOFT_WATER_READINGS } from "../lib/mockData";
import { Header } from "../components/Header";
import { WaterTypeBar } from "../components/WaterTypeBar";
import { RealtimeView } from "../components/RealtimeView";
import { FormView } from "../components/FormView";
import { AnalysisView } from "../components/AnalysisView";
import { SettingsSheet } from "../components/SettingsSheet";
import { ParamDetailDrawer } from "../components/ParamDetailDrawer";
import { TimeRange, computePreset } from "../components/TimePicker";
import { exchangeSSOToken, clearAuth } from "../lib/iosense/auth";
import {
  SensorMap,
  autoMapSensors,
  fetchDeviceMeta,
  fetchReadings,
  clearReadingsCache,
} from "../lib/iosense/dataService";
import { WaterType, configFor, WATER_TYPES } from "../lib/waterTypes";
import { ConnectionBanner, AuthStatus } from "../components/ConnectionBanner";

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
  // Single shared time range across Overview / QC Log / Analysis. Default = This Week.
  const [timeRange, setTimeRange] = useState<TimeRange>(() => computePreset("currentWeek", NOW_TS));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drillKey, setDrillKey] = useState<string | null>(null);

  // Per-water-type customisation — each tab keeps its own params & settings.
  const [paramsByType, setParamsByType] = useState<Record<WaterType, ParamSpec[]>>(() => ({
    treated: [...DEFAULT_PARAMS],
    raw:     [...RAW_WATER_PARAMS],
    soft:    [...SOFT_WATER_PARAMS],
  }));
  const [settingsByType, setSettingsByType] = useState<Record<WaterType, AppSettings>>(
    () => initialPerType(() => ({ ...DEFAULT_SETTINGS }))
  );

  // Per-water-type data
  const [sensorMap, setSensorMap] = useState<SensorMap>({});
  const [readingsByType, setReadingsByType] = useState<Record<WaterType, Reading[]>>(
    () => initialPerType<Reading[]>(() => [])
  );
  const [dataLoading, setDataLoading] = useState(false);

  // Connection status — surfaces auth/fetch failures to the user
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [authBump, setAuthBump] = useState(0); // re-trigger init after manual token

  const currentConfig = configFor(waterType);
  const params = paramsByType[waterType];
  const settings = settingsByType[waterType];
  const readings = readingsByType[waterType];

  // Fall back to local mock data until live IOsense readings are loaded
  const MOCK_BY_TYPE: Record<WaterType, Reading[]> = useMemo(() => ({
    treated: MOCK_READINGS,
    raw:     RAW_WATER_READINGS,
    soft:    SOFT_WATER_READINGS,
  }), []);
  const effectiveReadings = readings.length > 0 ? readings : MOCK_BY_TYPE[waterType];

  useEffect(() => {
    async function init() {
      setAuthStatus("checking");
      setAuthError(null);
      try {
        const auth = await exchangeSSOToken();
        if (!auth) {
          console.warn("[IOsense] No SSO token in URL and no stored bearer token. Awaiting manual JWT or portal launch.");
          setAuthStatus("no-token");
          return;
        }
        console.log("[IOsense] Authenticated. org =", auth.organisation);
        setAuthStatus("authenticated");
        const meta = await fetchDeviceMeta(currentConfig.deviceId);
        console.log(`[IOsense] Device ${currentConfig.deviceId} meta loaded.`, meta?.sensors?.length, "sensors");
        const map = autoMapSensors(meta.sensors, currentConfig.deviceId);
        console.log(`[IOsense] Mapped ${Object.keys(map).length} sensors → params for ${currentConfig.deviceId}`);
        if (Object.keys(map).length === 0) {
          console.warn(`[IOsense] No sensor map for ${currentConfig.deviceId}. Sensors available:`, meta.sensors);
        }
        setSensorMap(map);
      } catch (err: any) {
        console.error("[IOsense] Init error:", err);
        setAuthStatus("error");
        setAuthError(err?.message ?? String(err));
      }
    }
    init();
  }, [currentConfig.deviceId, authBump]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      console.log(`[IOsense] Fetching readings for ${currentConfig.deviceId} (${waterType})…`);
      const data = await fetchReadings(sensorMap, currentConfig.deviceId);
      console.log(`[IOsense] Got ${data.length} readings.`);
      setReadingsByType((prev) => ({ ...prev, [waterType]: data }));
      setLastFetchedAt(Date.now());
    } catch (err: any) {
      console.error("[IOsense] Fetch error:", err);
      setDataError(err?.message ?? String(err));
    } finally {
      setDataLoading(false);
    }
  }, [sensorMap, currentConfig.deviceId, waterType]);

  const handleSignOut = () => {
    clearAuth();
    clearReadingsCache();
    setAuthStatus("no-token");
    setSensorMap({});
    setReadingsByType(initialPerType<Reading[]>(() => []));
    setLastFetchedAt(null);
  };

  const handleRefresh = () => {
    clearReadingsCache();
    setReadingsByType(initialPerType<Reading[]>(() => []));
    setAuthBump((n) => n + 1);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => { setDrillKey(null); }, [waterType]);

  const filteredReadings = useMemo(
    () => effectiveReadings.filter((r) => r.ts >= timeRange.startTs && r.ts <= timeRange.endTs),
    [effectiveReadings, timeRange]
  );

  const DEFAULT_PARAMS_FOR_TYPE: Record<WaterType, ParamSpec[]> = {
    treated: DEFAULT_PARAMS,
    raw:     RAW_WATER_PARAMS,
    soft:    SOFT_WATER_PARAMS,
  };

  // Customisation badge: true if THIS tab's settings differ from defaults
  const customized = useMemo(
    () =>
      JSON.stringify(params) !== JSON.stringify(DEFAULT_PARAMS_FOR_TYPE[waterType]) ||
      JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS),
    [params, settings, waterType]
  );

  const saveSettings = (p: ParamSpec[], s: AppSettings) => {
    setParamsByType((prev) => ({ ...prev, [waterType]: p }));
    setSettingsByType((prev) => ({ ...prev, [waterType]: s }));
    setSettingsOpen(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <Header view={view} onView={setView} />

      <WaterTypeBar
        value={waterType}
        onChange={setWaterType}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        onOpenSettings={() => setSettingsOpen(true)}
        customized={customized}
      />

      <ConnectionBanner
        authStatus={authStatus}
        authError={authError}
        dataError={dataError}
        readingsCount={readings.length}
        lastFetchedAt={lastFetchedAt}
        deviceId={currentConfig.deviceId}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
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
            readings={filteredReadings}
            range={timeRange}
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
            readings={filteredReadings}
            range={timeRange}
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
        readings={effectiveReadings}
        range={timeRange}
        onRangeChange={setTimeRange}
        onClose={() => setDrillKey(null)}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
