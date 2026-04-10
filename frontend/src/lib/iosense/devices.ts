// Device discovery and data fetching

import { apiFetch } from "./api";

export interface Sensor {
  sensorId: string;
  sensorName: string;
}

export interface Device {
  devID: string;
  devName: string;
  devTypeID: string;
  devTypeName: string;
  sensors: Sensor[];
  unitSelected: Record<string, string>;
  tags: string[];
}

interface FindDevicesResponse {
  success: boolean;
  data: {
    totalCount: number;
    data: Device[];
  };
}

export async function findDevices(search?: {
  devTypeID?: string[];
  all?: string[];
}): Promise<Device[]> {
  const body: Record<string, unknown> = {
    search: search ?? [],
    filter: [],
    order: "default",
    sort: "AtoZ",
  };

  const res = await apiFetch<FindDevicesResponse>(
    "/account/devices/1/100",
    { method: "PUT", body: JSON.stringify(body) }
  );

  if (!res.success) throw new Error("findDevices failed");
  return res.data.data;
}

export interface DataPoint {
  time: string;
  value: number;
}

export async function getLatestValues(
  pairs: { devID: string; sensor: string }[]
): Promise<{ devID: string; sensor: string; time: string; value: number; unit: string }[]> {
  const res = await apiFetch<{ success: boolean; data: any[] }>(
    "/account/deviceData/getLastDPsofDevicesAndSensorProcessed",
    { method: "PUT", body: JSON.stringify({ devices: pairs }) }
  );
  if (!res.success) throw new Error("getLatestValues failed");
  return res.data;
}

export async function getTimeSeriesData(
  devID: string,
  sensor: string,
  sTime: number,
  eTime: number
): Promise<DataPoint[]> {
  const res = await apiFetch<{ success: boolean; data: DataPoint[][] }>(
    `/account/deviceData/getDataCalibration/${devID}/${sensor}/${sTime}/${eTime}/true`
  );
  if (!res.success) throw new Error("getTimeSeriesData failed");
  return res.data.flat();
}

export async function getDownsampledData(
  configs: { devID: string; sensor: string; sTime: number; eTime: number }[]
): Promise<Record<string, { time: string; value: number }[]>> {
  const devConfig = configs.map((c) => ({
    devID: c.devID,
    sensor: c.sensor,
    sTime: c.sTime,
    eTime: c.eTime,
    downscale: true,
  }));

  const res = await apiFetch<{ success: boolean; data: any }>(
    "/account/deviceData/getDeviceAutoDownSampledData",
    { method: "PUT", body: JSON.stringify({ devConfig }) }
  );
  if (!res.success) throw new Error("getDownsampledData failed");
  return res.data;
}
