"use client";

export type AuthStatus = "checking" | "authenticated" | "no-token" | "error";

interface Props {
  authStatus: AuthStatus;
  authError?: string | null;
  dataError?: string | null;
  readingsCount: number;
  lastFetchedAt?: number | null;
  deviceId: string;
  onRefresh: () => void;
  onSignOut: () => void;
}

export function ConnectionBanner({
  authStatus,
  authError,
  dataError,
  deviceId,
  onRefresh,
}: Props) {
  // Only surface real problems — no chatter when things are fine,
  // no banner just because the device hasn't returned rows yet.
  const isError = authStatus === "error" || !!authError || !!dataError;
  const isMissing = authStatus === "no-token";
  if (!isError && !isMissing) return null;

  const is401 = /401|Invalid Authorization|Try Logging-in/i.test(authError ?? dataError ?? "");

  const bg     = isError ? "#fef2f2" : "#fffbeb";
  const border = isError ? "#fecaca" : "#fed7aa";
  const fg     = isError ? "#991b1b" : "#92400e";

  const headline =
    is401                       ? "Session expired" :
    authStatus === "no-token"  ? "Not signed in" :
    authStatus === "error"     ? "Authentication failed" :
                                  "Could not load device data";

  const detail =
    is401
      ? "Please re-launch this app from the IOsense portal."
      : authStatus === "no-token"
        ? `Launch this app from the IOsense portal to load ${deviceId}.`
        : (authError || dataError || "");

  return (
    <div
      style={{
        background: bg,
        borderBottom: `1px solid ${border}`,
        color: fg,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "10px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isError ? "#ef4444" : "#f59e0b",
              display: "inline-block",
            }}
          />
          <b>{headline}</b>
        </div>
        {detail && <div style={{ opacity: 0.85 }}>{detail}</div>}

        {dataError && !is401 && (
          <button
            onClick={onRefresh}
            style={{
              marginLeft: "auto",
              padding: "5px 12px",
              background: "white",
              border: `1px solid ${border}`,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              color: fg,
            }}
          >
            Retry fetch
          </button>
        )}
      </div>
    </div>
  );
}
