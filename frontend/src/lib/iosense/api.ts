// Base API client — calls the IOsense connector directly from the browser.
// connector.iosense.io has `access-control-allow-origin: *` so no proxy is needed,
// which also lets the app be deployed as a static (CSR) build.

const BASE = "https://connector.iosense.io/api";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("bearer_token") ?? "";
}

export function getOrg(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("iosense_org") ?? "";
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const token = getToken();
  const org = getOrg();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngsw-bypass": "true",
    ...(token ? { Authorization: token } : {}),
    ...(org ? { organisation: org } : {}),
  };

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };

  if (options.body !== undefined && options.body !== null) {
    init.body =
      typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${path}`, init);

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`IOsense ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
