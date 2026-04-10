// Specs sourced directly from the Treated Water QC form (After 1 Micron)

export type ParamKey =
  | "pH"
  | "tds"
  | "turbidity"
  | "pAlkalinity"
  | "mAlkalinity"
  | "freeCl"
  | "totalCl"
  | "totalHardness"
  | "caHardness"
  | "aluminium"
  | "chloride"
  | "iron"
  | "sulphate"
  | "sulphateChloride";

export type Frequency = "4h" | "daily";

export interface ParamSpec {
  key: ParamKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  frequency: Frequency;
  decimals: number;
  specDisplay: string;
  nilSpec?: boolean; // spec is "Nil" — any detected value is a breach
}

export const DEFAULT_PARAMS: ParamSpec[] = [
  // 4-hourly params
  { key: "pH",              label: "pH",                unit: "",       min: 6.0, max: 8.5,  frequency: "4h",    decimals: 2, specDisplay: "6.0 – 8.5" },
  { key: "tds",             label: "TDS",               unit: "Mg/L",   min: 0,   max: 500,  frequency: "4h",    decimals: 0, specDisplay: "<500 Mg/L" },
  { key: "pAlkalinity",     label: "P Alkalinity",      unit: "Mg/L",   min: 0,   max: 0.05, frequency: "4h",    decimals: 2, specDisplay: "Nil",       nilSpec: true },
  { key: "mAlkalinity",     label: "M Alkalinity",      unit: "Mg/L",   min: 0,   max: 85,   frequency: "4h",    decimals: 0, specDisplay: "<85 Mg/L" },
  { key: "turbidity",       label: "Turbidity",         unit: "NTU",    min: 0,   max: 0.3,  frequency: "4h",    decimals: 2, specDisplay: "<0.3 NTU" },
  { key: "freeCl",          label: "Free Chlorine",     unit: "ppm",    min: 0,   max: 0.05, frequency: "4h",    decimals: 2, specDisplay: "Nil",       nilSpec: true },
  { key: "totalCl",         label: "Total Chlorine",    unit: "ppm",    min: 0,   max: 0.05, frequency: "4h",    decimals: 2, specDisplay: "Nil",       nilSpec: true },
  // Daily params
  { key: "totalHardness",   label: "Total Hardness",    unit: "Mg/L",   min: 0,   max: 100,  frequency: "daily", decimals: 0, specDisplay: "<100 Mg/L" },
  { key: "caHardness",      label: "Ca Hardness",       unit: "Mg/L",   min: 0,   max: 100,  frequency: "daily", decimals: 0, specDisplay: "—" },
  { key: "aluminium",       label: "Aluminium",         unit: "Mg/L",   min: 0,   max: 0.2,  frequency: "daily", decimals: 2, specDisplay: "<0.2 Mg/L" },
  { key: "chloride",        label: "Chloride",          unit: "Mg/L",   min: 0,   max: 250,  frequency: "daily", decimals: 0, specDisplay: "<250 Mg/L" },
  { key: "iron",            label: "Iron",              unit: "mg/L",   min: 0,   max: 0.1,  frequency: "daily", decimals: 2, specDisplay: "<0.1 mg/L" },
  { key: "sulphate",        label: "Sulphate",          unit: "Mg/L",   min: 0,   max: 250,  frequency: "daily", decimals: 0, specDisplay: "<250 Mg/L" },
  { key: "sulphateChloride",label: "Sulphate+Chloride", unit: "mg/L",   min: 0,   max: 400,  frequency: "daily", decimals: 0, specDisplay: "<400 mg/L" },
];

export const DEFAULT_SETTINGS = {
  warningBufferPct: 10,
  driftWindowN: 6,
  driftProjectionM: 3,
  shifts: [
    { name: "A", start: "06:00", end: "14:00" },
    { name: "B", start: "14:00", end: "22:00" },
    { name: "C", start: "22:00", end: "06:00" },
  ],
};

export const FREQUENCY_HOURS: Record<Frequency, number> = {
  "4h": 4,
  "daily": 24,
};
