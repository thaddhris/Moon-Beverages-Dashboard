// Base API client — routes through /api/iosense proxy to avoid CORS

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
    ...(token ? { Authorization: token } : {}),
    ...(org ? { organisation: org } : {}),
  };

  const res = await fetch("/api/iosense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      method: options.method ?? "GET",
      headers,
      body: options.body,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Proxy ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
