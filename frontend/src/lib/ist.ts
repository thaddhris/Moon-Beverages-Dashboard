// IST (UTC+05:30) date utilities.
// The entire app serves an Indian plant — all dates/times are IST.

const IST_OFFSET_MS = 5.5 * 3600 * 1000; // +5:30 in ms
const DAY_MS = 24 * 3600 * 1000;

// Shift a UTC epoch so that getUTC*() methods return IST values.
export function istDate(ts: number): Date {
  return new Date(ts + IST_OFFSET_MS);
}

export function istHours(ts: number): number {
  return istDate(ts).getUTCHours();
}

export function startOfIstDay(ts: number): number {
  return Math.floor((ts + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

export function endOfIstDay(ts: number): number {
  return startOfIstDay(ts) + DAY_MS - 60000;
}

export function startOfIstWeek(ts: number): number {
  const d = istDate(startOfIstDay(ts));
  return startOfIstDay(ts) - d.getUTCDay() * DAY_MS;
}

export function startOfIstMonth(ts: number): number {
  const d = istDate(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - IST_OFFSET_MS;
}

export function endOfIstMonth(ts: number): number {
  const d = istDate(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - IST_OFFSET_MS - 60000;
}

export function startOfIstYear(ts: number): number {
  const y = istDate(ts).getUTCFullYear();
  return Date.UTC(y, 0, 1) - IST_OFFSET_MS;
}

export function fmtDateIST(ts: number): string {
  const d = istDate(ts);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtTimeIST(ts: number): string {
  const d = istDate(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function fmtDateTimeIST(ts: number): string {
  return `${fmtDateIST(ts)} ${fmtTimeIST(ts)}`;
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function fmtDateShortIST(ts: number): string {
  const d = istDate(ts);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export { IST_OFFSET_MS, DAY_MS };
