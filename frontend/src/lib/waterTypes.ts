export type WaterType = "treated" | "raw" | "soap";

export interface WaterTypeConfig {
  key: WaterType;
  label: string;
  shortLabel: string;
  deviceId: string;
  subtitle: string;
}

// All three currently use the same device — swap deviceId per type later.
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
    deviceId: "TREATED_WATER_COLA",
    subtitle: "Raw Water Analysis — Source Feed",
  },
  {
    key: "soap",
    label: "Soap Water",
    shortLabel: "Soap",
    deviceId: "TREATED_WATER_COLA",
    subtitle: "Soap Water Analysis — CIP Rinse",
  },
];

export function configFor(key: WaterType): WaterTypeConfig {
  return WATER_TYPES.find((w) => w.key === key) ?? WATER_TYPES[0];
}
