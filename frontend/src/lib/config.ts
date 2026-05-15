export type ParamKey =
  // ─ Treated Water ─────────────────────────────────────────────────────────
  | "pH" | "tds" | "turbidity" | "pAlkalinity" | "mAlkalinity"
  | "freeCl" | "totalCl" | "residualCl"
  | "totalHardness" | "caHardness" | "aluminium"
  | "chloride" | "iron" | "sulphate" | "sulphateChloride"
  // ─ Raw Water · Storage Tank ───────────────────────────────────────────────
  | "pH_st" | "tds_st" | "totalHardness_st" | "caHardness_st"
  | "pAlkalinity_st" | "mAlkalinity_st" | "turbidity_st"
  | "iron_st" | "chloride_st" | "sulphate_st"
  // ─ Raw Water · Borewell 1 ─────────────────────────────────────────────────
  | "pH_bw1" | "tds_bw1" | "totalHardness_bw1" | "caHardness_bw1"
  | "pAlkalinity_bw1" | "mAlkalinity_bw1" | "turbidity_bw1"
  | "iron_bw1" | "chloride_bw1" | "sulphate_bw1"
  // ─ Raw Water · Borewell 2 ─────────────────────────────────────────────────
  | "pH_bw2" | "tds_bw2" | "totalHardness_bw2" | "caHardness_bw2"
  | "pAlkalinity_bw2" | "mAlkalinity_bw2" | "turbidity_bw2"
  | "iron_bw2" | "chloride_bw2" | "sulphate_bw2"
  // ─ Raw Water · Borewell 3 ─────────────────────────────────────────────────
  | "pH_bw3" | "tds_bw3" | "totalHardness_bw3" | "caHardness_bw3"
  | "pAlkalinity_bw3" | "mAlkalinity_bw3" | "turbidity_bw3"
  | "iron_bw3" | "chloride_bw3" | "sulphate_bw3"
  // ─ Raw Water · RW Storage Tank Residual Cl₂ stage (12h) ──────────────────
  | "pH_rwt" | "tds_rwt" | "totalHardness_rwt" | "caHardness_rwt"
  | "pAlkalinity_rwt" | "mAlkalinity_rwt" | "turbidity_rwt" | "residualCl_rwt"
  | "iron_rwt" | "chloride_rwt" | "sulphate_rwt"
  // ─ Raw Water · Clear Water Storage Tank Residual Cl₂ stage (daily) ───────
  | "pH_cwt" | "tds_cwt" | "totalHardness_cwt" | "caHardness_cwt"
  | "pAlkalinity_cwt" | "mAlkalinity_cwt" | "turbidity_cwt" | "residualCl_cwt"
  | "iron_cwt" | "chloride_cwt" | "sulphate_cwt"
  // ─ Raw Water · Filter Water Storage Tank Residual Cl₂ stage (daily) ──────
  | "pH_fwt" | "tds_fwt" | "totalHardness_fwt" | "caHardness_fwt"
  | "pAlkalinity_fwt" | "mAlkalinity_fwt" | "turbidity_fwt" | "residualCl_fwt"
  | "iron_fwt" | "chloride_fwt" | "sulphate_fwt"
  // ─ Soft Water · Non-Chlorinated ───────────────────────────────────────────
  | "pH_nc" | "tds_nc" | "totalHardness_nc" | "caHardness_nc"
  | "mAlkalinity_nc" | "turbidity_nc" | "residualCl_nc" | "chloride_nc" | "iron_nc"
  // ─ Soft Water · Chlorinated ───────────────────────────────────────────────
  | "pH_ch" | "tds_ch" | "totalHardness_ch" | "caHardness_ch"
  | "mAlkalinity_ch" | "turbidity_ch" | "residualCl_ch" | "chloride_ch" | "iron_ch";

export type Frequency = "4h" | "12h" | "daily" | "weekly";

export interface ParamSpec {
  key: ParamKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  frequency: Frequency;
  decimals: number;
  specDisplay: string;
  nilSpec?: boolean;
  // Named category group — shown as a section header in the QC log / overview.
  // Absence means the param belongs to no category (Treated Water, weekly raw params).
  category?: string;
  // Optional manual Six-Sigma control limits (override auto μ±3σ).
  uclOverride?: number;
  lclOverride?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Treated Water — After 1 Micron
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_PARAMS: ParamSpec[] = [
  // 4-hourly
  { key: "pH",              label: "pH",                unit: "",       min: 6.0, max: 8.5,  frequency: "4h",    decimals: 2, specDisplay: "6.0 – 8.5" },
  { key: "tds",             label: "TDS",               unit: "Mg/L",   min: 0,   max: 500,  frequency: "4h",    decimals: 0, specDisplay: "<500 Mg/L" },
  { key: "pAlkalinity",     label: "P Alkalinity",      unit: "Mg/L",   min: 0,   max: 0.05, frequency: "4h",    decimals: 2, specDisplay: "Nil",       nilSpec: true },
  { key: "mAlkalinity",     label: "M Alkalinity",      unit: "Mg/L",   min: 0,   max: 85,   frequency: "4h",    decimals: 0, specDisplay: "<85 Mg/L" },
  { key: "turbidity",       label: "Turbidity",         unit: "NTU",    min: 0,   max: 0.3,  frequency: "4h",    decimals: 2, specDisplay: "<0.3 NTU" },
  { key: "freeCl",          label: "Free Chlorine",     unit: "ppm",    min: 0,   max: 0.05, frequency: "4h",    decimals: 2, specDisplay: "Nil",       nilSpec: true },
  { key: "totalCl",         label: "Total Chlorine",    unit: "ppm",    min: 0,   max: 0.05, frequency: "4h",    decimals: 2, specDisplay: "Nil",       nilSpec: true },
  // Daily
  { key: "totalHardness",   label: "Total Hardness",    unit: "Mg/L",   min: 0,   max: 100,  frequency: "daily", decimals: 0, specDisplay: "<100 Mg/L" },
  { key: "caHardness",      label: "Ca Hardness",       unit: "Mg/L",   min: 0,   max: 100,  frequency: "daily", decimals: 0, specDisplay: "—" },
  { key: "aluminium",       label: "Aluminium",         unit: "Mg/L",   min: 0,   max: 0.2,  frequency: "daily", decimals: 2, specDisplay: "<0.2 Mg/L" },
  { key: "chloride",        label: "Chloride",          unit: "Mg/L",   min: 0,   max: 250,  frequency: "daily", decimals: 0, specDisplay: "<250 Mg/L" },
  { key: "iron",            label: "Iron",              unit: "mg/L",   min: 0,   max: 0.1,  frequency: "daily", decimals: 2, specDisplay: "<0.1 mg/L" },
  { key: "sulphate",        label: "Sulphate",          unit: "Mg/L",   min: 0,   max: 250,  frequency: "daily", decimals: 0, specDisplay: "<250 Mg/L" },
  { key: "sulphateChloride",label: "Sulphate+Chloride", unit: "mg/L",   min: 0,   max: 400,  frequency: "daily", decimals: 0, specDisplay: "<400 mg/L" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Raw Water — Source Feed (Borewell / Storage Tank)
// Each source is a named category; weekly chemical tests have no category.
// Sensor IDs for raw-water device TBD — mapped in dataService when confirmed.
// ─────────────────────────────────────────────────────────────────────────────
export const RAW_WATER_PARAMS: ParamSpec[] = [
  // Raw Water Storage Tank — daily + weekly
  { key: "pH_st",            label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "daily",  decimals: 2, specDisplay: "6.5 – 8.5",   category: "Raw Water Storage Tank" },
  { key: "tds_st",           label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "daily",  decimals: 0, specDisplay: "<1000 Mg/L",  category: "Raw Water Storage Tank" },
  { key: "totalHardness_st", label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "daily",  decimals: 0, specDisplay: "<300 Mg/L",   category: "Raw Water Storage Tank" },
  { key: "caHardness_st",    label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "daily",  decimals: 0, specDisplay: "—",            category: "Raw Water Storage Tank" },
  { key: "pAlkalinity_st",   label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "daily",  decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Raw Water Storage Tank" },
  { key: "mAlkalinity_st",   label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "daily",  decimals: 0, specDisplay: "<500 Mg/L",   category: "Raw Water Storage Tank" },
  { key: "turbidity_st",     label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "daily",  decimals: 1, specDisplay: "<10 NTU",     category: "Raw Water Storage Tank" },
  { key: "iron_st",          label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Raw Water Storage Tank" },
  { key: "chloride_st",      label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Raw Water Storage Tank" },
  { key: "sulphate_st",      label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Raw Water Storage Tank" },

  // Borewell No. 1 — daily + weekly
  { key: "pH_bw1",           label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "daily",  decimals: 2, specDisplay: "6.5 – 8.5",   category: "Borewell No. 1" },
  { key: "tds_bw1",          label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "daily",  decimals: 0, specDisplay: "<1000 Mg/L",  category: "Borewell No. 1" },
  { key: "totalHardness_bw1",label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "daily",  decimals: 0, specDisplay: "<300 Mg/L",   category: "Borewell No. 1" },
  { key: "caHardness_bw1",   label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "daily",  decimals: 0, specDisplay: "—",            category: "Borewell No. 1" },
  { key: "pAlkalinity_bw1",  label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "daily",  decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Borewell No. 1" },
  { key: "mAlkalinity_bw1",  label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "daily",  decimals: 0, specDisplay: "<500 Mg/L",   category: "Borewell No. 1" },
  { key: "turbidity_bw1",    label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "daily",  decimals: 1, specDisplay: "<10 NTU",     category: "Borewell No. 1" },
  { key: "iron_bw1",         label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Borewell No. 1" },
  { key: "chloride_bw1",     label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Borewell No. 1" },
  { key: "sulphate_bw1",     label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Borewell No. 1" },

  // Borewell No. 2 — daily + weekly
  { key: "pH_bw2",           label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "daily",  decimals: 2, specDisplay: "6.5 – 8.5",   category: "Borewell No. 2" },
  { key: "tds_bw2",          label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "daily",  decimals: 0, specDisplay: "<1000 Mg/L",  category: "Borewell No. 2" },
  { key: "totalHardness_bw2",label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "daily",  decimals: 0, specDisplay: "<300 Mg/L",   category: "Borewell No. 2" },
  { key: "caHardness_bw2",   label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "daily",  decimals: 0, specDisplay: "—",            category: "Borewell No. 2" },
  { key: "pAlkalinity_bw2",  label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "daily",  decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Borewell No. 2" },
  { key: "mAlkalinity_bw2",  label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "daily",  decimals: 0, specDisplay: "<500 Mg/L",   category: "Borewell No. 2" },
  { key: "turbidity_bw2",    label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "daily",  decimals: 1, specDisplay: "<10 NTU",     category: "Borewell No. 2" },
  { key: "iron_bw2",         label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Borewell No. 2" },
  { key: "chloride_bw2",     label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Borewell No. 2" },
  { key: "sulphate_bw2",     label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Borewell No. 2" },

  // Borewell No. 3 — daily + weekly
  { key: "pH_bw3",           label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "daily",  decimals: 2, specDisplay: "6.5 – 8.5",   category: "Borewell No. 3" },
  { key: "tds_bw3",          label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "daily",  decimals: 0, specDisplay: "<1000 Mg/L",  category: "Borewell No. 3" },
  { key: "totalHardness_bw3",label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "daily",  decimals: 0, specDisplay: "<300 Mg/L",   category: "Borewell No. 3" },
  { key: "caHardness_bw3",   label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "daily",  decimals: 0, specDisplay: "—",            category: "Borewell No. 3" },
  { key: "pAlkalinity_bw3",  label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "daily",  decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Borewell No. 3" },
  { key: "mAlkalinity_bw3",  label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "daily",  decimals: 0, specDisplay: "<500 Mg/L",   category: "Borewell No. 3" },
  { key: "turbidity_bw3",    label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "daily",  decimals: 1, specDisplay: "<10 NTU",     category: "Borewell No. 3" },
  { key: "iron_bw3",         label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Borewell No. 3" },
  { key: "chloride_bw3",     label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Borewell No. 3" },
  { key: "sulphate_bw3",     label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Borewell No. 3" },

  // Residual Cl₂ — three storage stages
  // ── Raw Water Storage Tank · Residual Cl₂ — 12-hourly ───────────────────────
  { key: "pH_rwt",            label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "12h",    decimals: 2, specDisplay: "6.5 – 8.5",   category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "tds_rwt",           label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "12h",    decimals: 0, specDisplay: "<1000 Mg/L",  category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "totalHardness_rwt", label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "12h",    decimals: 0, specDisplay: "<300 Mg/L",   category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "caHardness_rwt",    label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "12h",    decimals: 0, specDisplay: "—",            category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "pAlkalinity_rwt",   label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "12h",    decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "mAlkalinity_rwt",   label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "12h",    decimals: 0, specDisplay: "<500 Mg/L",   category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "turbidity_rwt",     label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "12h",    decimals: 1, specDisplay: "<10 NTU",     category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "residualCl_rwt",    label: "Residual Cl₂",   unit: "ppm",   min: 3,   max: 5,    frequency: "12h",    decimals: 2, specDisplay: "3 – 5 ppm",   category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "iron_rwt",          label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "chloride_rwt",      label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Raw Water Storage Tank · Residual Cl₂" },
  { key: "sulphate_rwt",      label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Raw Water Storage Tank · Residual Cl₂" },

  // ── Clear Water Storage Tank · Residual Cl₂ — daily ──────────────────────
  { key: "pH_cwt",            label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "daily",  decimals: 2, specDisplay: "6.5 – 8.5",   category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "tds_cwt",           label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "daily",  decimals: 0, specDisplay: "<1000 Mg/L",  category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "totalHardness_cwt", label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "daily",  decimals: 0, specDisplay: "<300 Mg/L",   category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "caHardness_cwt",    label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "daily",  decimals: 0, specDisplay: "—",            category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "pAlkalinity_cwt",   label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "daily",  decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "mAlkalinity_cwt",   label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "daily",  decimals: 0, specDisplay: "<500 Mg/L",   category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "turbidity_cwt",     label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "daily",  decimals: 1, specDisplay: "<10 NTU",     category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "residualCl_cwt",    label: "Residual Cl₂",   unit: "ppm",   min: 0,   max: 5,    frequency: "daily",  decimals: 2, specDisplay: "0 – 5 ppm",   category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "iron_cwt",          label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "chloride_cwt",      label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Clear Water Storage Tank · Residual Cl₂" },
  { key: "sulphate_cwt",      label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Clear Water Storage Tank · Residual Cl₂" },

  // ── Filter Water Storage Tank · Residual Cl₂ — daily ─────────────────────
  { key: "pH_fwt",            label: "pH",             unit: "",      min: 6.5, max: 8.5,  frequency: "daily",  decimals: 2, specDisplay: "6.5 – 8.5",   category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "tds_fwt",           label: "TDS",            unit: "Mg/L",  min: 0,   max: 1000, frequency: "daily",  decimals: 0, specDisplay: "<1000 Mg/L",  category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "totalHardness_fwt", label: "Total Hardness", unit: "Mg/L",  min: 0,   max: 300,  frequency: "daily",  decimals: 0, specDisplay: "<300 Mg/L",   category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "caHardness_fwt",    label: "Ca Hardness",    unit: "Mg/L",  min: 0,   max: 200,  frequency: "daily",  decimals: 0, specDisplay: "—",            category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "pAlkalinity_fwt",   label: "P Alkalinity",   unit: "Mg/L",  min: 0,   max: 0.05, frequency: "daily",  decimals: 2, specDisplay: "Nil", nilSpec: true, category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "mAlkalinity_fwt",   label: "M Alkalinity",   unit: "Mg/L",  min: 0,   max: 500,  frequency: "daily",  decimals: 0, specDisplay: "<500 Mg/L",   category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "turbidity_fwt",     label: "Turbidity",      unit: "NTU",   min: 0,   max: 10,   frequency: "daily",  decimals: 1, specDisplay: "<10 NTU",     category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "residualCl_fwt",    label: "Residual Cl₂",   unit: "ppm",   min: 0,   max: 5,    frequency: "daily",  decimals: 2, specDisplay: "0 – 5 ppm",   category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "iron_fwt",          label: "Iron",           unit: "mg/L",  min: 0,   max: 0.3,  frequency: "weekly", decimals: 2, specDisplay: "<0.3 mg/L",   category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "chloride_fwt",      label: "Chloride",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Filter Water Storage Tank · Residual Cl₂" },
  { key: "sulphate_fwt",      label: "Sulphate",       unit: "Mg/L",  min: 0,   max: 250,  frequency: "weekly", decimals: 0, specDisplay: "<250 Mg/L",   category: "Filter Water Storage Tank · Residual Cl₂" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Soft Water — Non-Chlorinated & Chlorinated
// Sensor IDs for soft-water device TBD — mapped in dataService when confirmed.
// ─────────────────────────────────────────────────────────────────────────────
export const SOFT_WATER_PARAMS: ParamSpec[] = [
  // Non-Chlorinated — 4-hourly
  { key: "pH_nc",            label: "pH",              unit: "",      min: 6.5, max: 8.5,  frequency: "4h",    decimals: 2, specDisplay: "6.5 – 8.5",  category: "Non-Chlorinated" },
  { key: "tds_nc",           label: "TDS",             unit: "Mg/L",  min: 0,   max: 500,  frequency: "4h",    decimals: 0, specDisplay: "<500 Mg/L",  category: "Non-Chlorinated" },
  { key: "totalHardness_nc", label: "Total Hardness",  unit: "Mg/L",  min: 0,   max: 75,   frequency: "4h",    decimals: 0, specDisplay: "<75 Mg/L",   category: "Non-Chlorinated" },
  { key: "caHardness_nc",    label: "Ca Hardness",     unit: "Mg/L",  min: 0,   max: 50,   frequency: "4h",    decimals: 0, specDisplay: "—",          category: "Non-Chlorinated" },
  { key: "mAlkalinity_nc",   label: "Total Alkalinity",unit: "Mg/L",  min: 0,   max: 200,  frequency: "4h",    decimals: 0, specDisplay: "<200 Mg/L",  category: "Non-Chlorinated" },
  { key: "turbidity_nc",     label: "Turbidity",       unit: "NTU",   min: 0,   max: 1,    frequency: "4h",    decimals: 2, specDisplay: "<1 NTU",     category: "Non-Chlorinated" },
  { key: "residualCl_nc",    label: "Residual Cl₂",    unit: "ppm",   min: 0,   max: 0.5,  frequency: "4h",    decimals: 2, specDisplay: "<0.5 ppm",   category: "Non-Chlorinated" },
  // Non-Chlorinated — daily
  { key: "chloride_nc",      label: "Chloride",        unit: "Mg/L",  min: 0,   max: 250,  frequency: "daily", decimals: 0, specDisplay: "<250 Mg/L",  category: "Non-Chlorinated" },
  { key: "iron_nc",          label: "Iron",            unit: "mg/L",  min: 0,   max: 0.1,  frequency: "daily", decimals: 2, specDisplay: "<0.1 mg/L",  category: "Non-Chlorinated" },

  // Chlorinated — 4-hourly
  { key: "pH_ch",            label: "pH",              unit: "",      min: 6.5, max: 8.5,  frequency: "4h",    decimals: 2, specDisplay: "6.5 – 8.5",  category: "Chlorinated" },
  { key: "tds_ch",           label: "TDS",             unit: "Mg/L",  min: 0,   max: 500,  frequency: "4h",    decimals: 0, specDisplay: "<500 Mg/L",  category: "Chlorinated" },
  { key: "totalHardness_ch", label: "Total Hardness",  unit: "Mg/L",  min: 0,   max: 75,   frequency: "4h",    decimals: 0, specDisplay: "<75 Mg/L",   category: "Chlorinated" },
  { key: "caHardness_ch",    label: "Ca Hardness",     unit: "Mg/L",  min: 0,   max: 50,   frequency: "4h",    decimals: 0, specDisplay: "—",          category: "Chlorinated" },
  { key: "mAlkalinity_ch",   label: "Total Alkalinity",unit: "Mg/L",  min: 0,   max: 200,  frequency: "4h",    decimals: 0, specDisplay: "<200 Mg/L",  category: "Chlorinated" },
  { key: "turbidity_ch",     label: "Turbidity",       unit: "NTU",   min: 0,   max: 1,    frequency: "4h",    decimals: 2, specDisplay: "<1 NTU",     category: "Chlorinated" },
  { key: "residualCl_ch",    label: "Residual Cl₂",    unit: "ppm",   min: 0,   max: 0.5,  frequency: "4h",    decimals: 2, specDisplay: "<0.5 ppm",   category: "Chlorinated" },
  // Chlorinated — daily
  { key: "chloride_ch",      label: "Chloride",        unit: "Mg/L",  min: 0,   max: 250,  frequency: "daily", decimals: 0, specDisplay: "<250 Mg/L",  category: "Chlorinated" },
  { key: "iron_ch",          label: "Iron",            unit: "mg/L",  min: 0,   max: 0.1,  frequency: "daily", decimals: 2, specDisplay: "<0.1 mg/L",  category: "Chlorinated" },
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
  "12h": 12,
  "daily": 24,
  "weekly": 168,
};
