// SSO token exchange — call once on app mount when ?token= is present in URL

export interface AuthResult {
  token: string;       // "Bearer eyJ..."
  organisation: string;
  userId: string;
}

/**
 * Exchanges a one-time SSO token from ?token= for a JWT.
 * Stores JWT + org in localStorage and strips the query param from the URL.
 * Returns null if no ?token= present (already authenticated via localStorage).
 */
export async function exchangeSSOToken(): Promise<AuthResult | null> {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const rawToken = url.searchParams.get("token");

  if (!rawToken) {
    // Check if we already have a stored token
    const existing = localStorage.getItem("bearer_token");
    if (existing) {
      return {
        token: existing,
        organisation: localStorage.getItem("iosense_org") ?? "",
        userId: localStorage.getItem("iosense_user") ?? "",
      };
    }
    return null;
  }

  // If it looks like a JWT or already has Bearer prefix, use directly
  if (rawToken.startsWith("eyJ") || rawToken.startsWith("Bearer ")) {
    const bearer = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
    localStorage.setItem("bearer_token", bearer);

    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());

    return { token: bearer, organisation: "", userId: "" };
  }

  // Otherwise treat as one-time SSO token and exchange it directly
  const res = await fetch(
    `https://connector.iosense.io/api/retrieve-sso-token/${rawToken}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "ngsw-bypass": "true",
        organisation: "https://iosense.io",
      },
    }
  );

  if (!res.ok) throw new Error(`SSO exchange failed: ${res.status}`);
  const data = await res.json();

  if (!data.success) throw new Error("SSO token invalid or expired");

  // Store and clean URL
  localStorage.setItem("bearer_token", data.token);
  localStorage.setItem("iosense_org", data.organisation);
  localStorage.setItem("iosense_user", data.userId);

  url.searchParams.delete("token");
  window.history.replaceState({}, "", url.toString());

  return { token: data.token, organisation: data.organisation, userId: data.userId };
}

export function clearAuth() {
  localStorage.removeItem("bearer_token");
  localStorage.removeItem("iosense_org");
  localStorage.removeItem("iosense_user");
}
