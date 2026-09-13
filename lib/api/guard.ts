import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_BODY_BYTES = 16 * 1024;

/**
 * Cheap, infra-free abuse check for the form route handlers: reject cross-site
 * fetches. Browsers set Sec-Fetch-Site; curl and the tests don't send it, and a
 * missing header passes. Returns a response to send, or null to continue.
 */
export function guard(req: Request): Response | null {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 403 });
  }
  return null;
}

/**
 * Parse a JSON body, enforcing the size cap on the bytes actually received —
 * a Content-Length check is bypassed by chunked transfer encoding. Returns the
 * parsed value, or the response to send.
 */
export async function readJson(req: Request): Promise<{ data: unknown } | { response: Response }> {
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ ok: false, message: "Request too large." }, { status: 413 }) };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { response: NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 }) };
  }
}

/** Single-line text field: trimmed, no CR/LF/tab, so it can never fold an email subject. */
export const line = (max: number) => z.string().trim().max(max).regex(/^[^\r\n\t]*$/);

/** Log a notification failure loudly enough that a misconfigured key can't hide submissions. */
export function logUndelivered(tag: string, reason: unknown, submission: Record<string, unknown>) {
  console.error(`[${tag}] staff notification failed:`, reason);
  console.warn(`[${tag}] UNDELIVERED submission:`, submission);
}
