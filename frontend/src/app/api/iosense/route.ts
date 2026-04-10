/**
 * Server-side proxy for IOsense connector API.
 * Body arrives as an object and is re-stringified here to avoid encoding issues.
 */

import { NextRequest, NextResponse } from "next/server";

const BASE = "https://connector.iosense.io/api";

export async function POST(req: NextRequest) {
  try {
    const { path, method = "GET", headers = {}, body } = await req.json();

    const bodyString = body !== undefined && body !== null
      ? (typeof body === "string" ? body : JSON.stringify(body))
      : undefined;

    console.log("[PROXY]", method, `${BASE}${path}`);
    console.log("[PROXY] headers:", { ...headers, Authorization: headers.Authorization ? "Bearer ***" : undefined });
    console.log("[PROXY] body:", bodyString);

    const upstream = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngsw-bypass": "true",
        ...headers,
      },
      ...(bodyString ? { body: bodyString } : {}),
    });

    const text = await upstream.text();
    console.log("[PROXY] upstream status:", upstream.status, "response:", text.slice(0, 300));

    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {
      return NextResponse.json({ success: false, error: text.slice(0, 500) }, { status: upstream.status });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
