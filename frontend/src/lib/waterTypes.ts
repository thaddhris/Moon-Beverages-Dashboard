export type WaterType = "treated" | "raw" | "soft";

export interface WaterTypeConfig {
  key: WaterType;
  label: string;
  shortLabel: string;
  deviceId: string;
  subtitle: string;
}

export const WATER_TYPES: WaterTypeConfig[] = [
  {
    key: "treated",
    label: "Treated Water",
    shortLabel: "Treated",
    deviceId: "TREATED_WATER_COLA",
    subtitle: "Treated Water Analysis — After 1 Micron",
  },
  {
    key: "raw",
    label: "Raw Water",
    shortLabel: "Raw",
    deviceId: "RAW_WATER_COLA",
    subtitle: "Raw Water Analysis — Source Feed",
  },
  {
    key: "soft",
    label: "Soft Water",
    shortLabel: "Soft",
    deviceId: "SOFT_WATER_COLA",
    subtitle: "Soft Water Analysis — Non-Chlorinated / Chlorinated",
  },
];

export function configFor(key: WaterType): WaterTypeConfig {
  return WATER_TYPES.find((w) => w.key === key) ?? WATER_TYPES[0];
}
