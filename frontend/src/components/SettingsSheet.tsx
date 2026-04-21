"use client";

import { useState, useEffect } from "react";
import { ParamSpec, DEFAULT_PARAMS, DEFAULT_SETTINGS } from "../lib/config";

interface Props {
  open: boolean;
  onClose: () => void;
  waterLabel?: string;
  params: ParamSpec[];
  settings: typeof DEFAULT_SETTINGS;
  onSave: (params: ParamSpec[], settings: typeof DEFAULT_SETTINGS) => void;
}

type Section = "limits" | "control" | "frequency" | "drift" | "shifts";

export function SettingsSheet({ open, onClose, waterLabel, params, settings, onSave }: Props) {
  const [draftParams, setDraftParams] = useState(params);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [section, setSection] = useState<Section>("limits");

  useEffect(() => {
    if (open) {
      setDraftParams(params);
      setDraftSettings(settings);
    }
  }, [open, params, settings]);

  if (!open) return null;

  const dirty =
    JSON.stringify(draftParams) !== JSON.stringify(params) ||
    JSON.stringify(draftSettings) !== JSON.stringify(settings);

  const updateParam = (key: string, field: "min" | "max", val: number) => {
    setDraftParams((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: val } : p)));
  };

  const updateParamOverride = (
    key: string,
    field: "uclOverride" | "lclOverride",
    val: number | undefined
  ) => {
    setDraftParams((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const next = { ...p };
        if (val === undefined || Number.isNaN(val)) delete next[field];
        else next[field] = val;
        return next;
      })
    );
  };

  const resetParam = (key: string) => {
    const def = DEFAULT_PARAMS.find((p) => p.key === key)!;
    setDraftParams((prev) => prev.map((p) => (p.key === key ? { ...def } : p)));
  };

  const resetAll = () => {
    if (confirm(`Restore ${waterLabel ?? "all"} settings to market standard? Your custom values will be lost.`)) {
      setDraftParams(DEFAULT_PARAMS.map((p) => ({ ...p })));
      setDraftSettings({ ...DEFAULT_SETTINGS });
    }
  };

  const isInvalid = draftParams.some((p) => !p.nilSpec && p.min >= p.max);

  const SECTIONS: { key: Section; label: string }[] = [
    { key: "limits",    label: "Parameter Limits" },
    { key: "control",   label: "Six Sigma Control Limits" },
    { key: "frequency", label: "Check Frequency" },
    { key: "drift",     label: "At Risk Thresholds" },
    { key: "shifts",    label: "Shifts" },
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[540px] bg-[var(--surface)] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--hairline)]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--ink-2)] font-medium">
              Settings · {waterLabel ?? "Current Category"}
            </div>
            <div className="text-[15px] font-medium mt-0.5">{waterLabel ?? "Settings"}</div>
            {(() => {
              const changes = draftParams.filter((p) => {
                const d = DEFAULT_PARAMS.find((x) => x.key === p.key)!;
                return (
                  d.min !== p.min ||
                  d.max !== p.max ||
                  d.frequency !== p.frequency ||
                  p.uclOverride !== undefined ||
                  p.lclOverride !== undefined
                );
              }).length;
              return changes > 0 ? (
                <div className="text-[11px] text-[var(--ink-2)] mt-0.5">
                  {changes} value{changes > 1 ? "s" : ""} customised · applies only to {waterLabel ?? "this category"}
                </div>
              ) : (
                <div className="text-[11px] text-[var(--ink-2)] mt-0.5">
                  All values at market standard · specific to {waterLabel ?? "this category"}
                </div>
              );
            })()}
          </div>
          <button onClick={onClose} className="text-[var(--ink-2)] hover:text-[var(--ink)] text-lg">×</button>
        </div>

        <div className="flex border-b border-[var(--hairline)] px-6 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`px-3 py-3 text-[12px] whitespace-nowrap transition-colors ${
                section === s.key
                  ? "text-[var(--ink)] border-b-2 border-[var(--ink)] -mb-px"
                  : "text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {section === "limits" && (
            <div className="space-y-2">
              {draftParams.map((p) => {
                const def = DEFAULT_PARAMS.find((x) => x.key === p.key)!;
                const customized = def.min !== p.min || def.max !== p.max;
                const invalid = p.min >= p.max;
                return (
                  <div key={p.key} className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px]">{p.label}</div>
                      <div className="text-[11px] text-[var(--ink-2)]">{p.unit || "—"}</div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={p.min}
                      onChange={(e) => updateParam(p.key, "min", parseFloat(e.target.value) || 0)}
                      className={`w-20 px-2 py-1 text-[13px] tnum text-right bg-[var(--bg)] rounded focus:outline-none ${invalid ? "text-[var(--breach)]" : ""}`}
                    />
                    <span className="text-[var(--ink-2)] text-[13px]">–</span>
                    <input
                      type="number"
                      step="0.01"
                      value={p.max}
                      onChange={(e) => updateParam(p.key, "max", parseFloat(e.target.value) || 0)}
                      className={`w-20 px-2 py-1 text-[13px] tnum text-right bg-[var(--bg)] rounded focus:outline-none ${invalid ? "text-[var(--breach)]" : ""}`}
                    />
                    <button
                      onClick={() => resetParam(p.key)}
                      className={`text-[11px] w-10 text-right ${customized ? "text-[var(--ink-2)] hover:text-[var(--ink)]" : "invisible"}`}
                    >
                      reset
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {section === "control" && (
            <div>
              <div className="text-[11px] text-[var(--ink-2)] mb-3 leading-relaxed">
                Enter a manual UCL / LCL to lock the control chart to a fixed band. Leave blank to auto-compute
                from the data as <b>μ ± 3σ</b>.
              </div>
              <div className="grid grid-cols-[1fr_100px_100px_40px] gap-x-3 gap-y-1 items-center text-[10px] uppercase tracking-[0.08em] text-[var(--ink-2)] font-medium pb-2 border-b border-[var(--hairline)] mb-2">
                <div>Parameter</div>
                <div className="text-right">LCL</div>
                <div className="text-right">UCL</div>
                <div />
              </div>
              <div className="space-y-1">
                {draftParams.map((p) => {
                  const hasOverride = p.uclOverride !== undefined || p.lclOverride !== undefined;
                  return (
                    <div key={p.key} className="grid grid-cols-[1fr_100px_100px_40px] gap-x-3 items-center py-1">
                      <div>
                        <div className="text-[13px]">{p.label}</div>
                        <div className="text-[10px] text-[var(--ink-2)]">
                          Spec {p.min}–{p.max} {p.unit}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="auto"
                        value={p.lclOverride ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          updateParamOverride(p.key, "lclOverride", v);
                        }}
                        className="w-full px-2 py-1 text-[13px] tnum text-right bg-[var(--bg)] rounded focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="auto"
                        value={p.uclOverride ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          updateParamOverride(p.key, "uclOverride", v);
                        }}
                        className="w-full px-2 py-1 text-[13px] tnum text-right bg-[var(--bg)] rounded focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          updateParamOverride(p.key, "uclOverride", undefined);
                          updateParamOverride(p.key, "lclOverride", undefined);
                        }}
                        className={`text-[11px] text-right ${hasOverride ? "text-[var(--ink-2)] hover:text-[var(--ink)]" : "invisible"}`}
                      >
                        clear
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {section === "frequency" && (
            <div className="space-y-2">
              {draftParams.map((p) => (
                <div key={p.key} className="flex items-center justify-between py-1.5">
                  <div className="text-[13px]">{p.label}</div>
                  <select
                    value={p.frequency}
                    onChange={(e) => setDraftParams((prev) => prev.map((x) => (x.key === p.key ? { ...x, frequency: e.target.value as ParamSpec["frequency"] } : x)))}
                    className="px-2 py-1 text-[13px] bg-[var(--bg)] rounded focus:outline-none"
                  >
                    <option value="4h">Every 4h</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {section === "drift" && (
            <div className="space-y-4">
              <div>
                <div className="label mb-2">At Risk Buffer</div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={draftSettings.warningBufferPct}
                    onChange={(e) => setDraftSettings({ ...draftSettings, warningBufferPct: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 text-[13px] tnum bg-[var(--bg)] rounded focus:outline-none"
                  />
                  <span className="text-[13px] text-[var(--ink-2)]">% of range from limit</span>
                </div>
              </div>
              <div>
                <div className="label mb-2">Trend Window (N)</div>
                <input
                  type="number"
                  value={draftSettings.driftWindowN}
                  onChange={(e) => setDraftSettings({ ...draftSettings, driftWindowN: parseInt(e.target.value) || 0 })}
                  className="w-20 px-2 py-1 text-[13px] tnum bg-[var(--bg)] rounded focus:outline-none"
                />
                <div className="text-[11px] text-[var(--ink-2)] mt-1">Past readings used for slope</div>
              </div>
              <div>
                <div className="label mb-2">Projection (M)</div>
                <input
                  type="number"
                  value={draftSettings.driftProjectionM}
                  onChange={(e) => setDraftSettings({ ...draftSettings, driftProjectionM: parseInt(e.target.value) || 0 })}
                  className="w-20 px-2 py-1 text-[13px] tnum bg-[var(--bg)] rounded focus:outline-none"
                />
                <div className="text-[11px] text-[var(--ink-2)] mt-1">Readings ahead to project</div>
              </div>
            </div>
          )}

          {section === "shifts" && (
            <div className="space-y-2">
              {draftSettings.shifts.map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="text-[13px] w-8">{s.name}</div>
                  <input value={s.start} readOnly className="w-20 px-2 py-1 text-[13px] tnum bg-[var(--bg)] rounded" />
                  <span className="text-[var(--ink-2)] text-[13px]">–</span>
                  <input value={s.end} readOnly className="w-20 px-2 py-1 text-[13px] tnum bg-[var(--bg)] rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--hairline)] px-6 py-4 flex items-center justify-between">
          <button onClick={resetAll} className="text-[12px] text-[var(--ink-2)] hover:text-[var(--ink)]">
            Reset {waterLabel ?? "all"} to market standard
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)]">
              Cancel
            </button>
            <button
              disabled={!dirty || isInvalid}
              onClick={() => onSave(draftParams, draftSettings)}
              className="px-4 py-1.5 text-[13px] bg-[var(--ink)] text-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
