import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_BODY_BYTES = 16 * 1024;

/**
 * Cheap, infra-free abuse checks for the form route handlers: reject cross-site
 * fetches (browsers set Sec-Fetch-Site; curl and tests don't send it and pass)
 * and cap the body size. Returns a response to send, or null to continue.
 */
export function guard(req: Request): Response | null {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 403 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "Request too large." }, { status: 413 });
  }
  return null;
}

/** Single-line text field: trimmed, no CR/LF/tab, so it can never fold an email subject. */
export const line = (max: number) => z.string().trim().max(max).regex(/^[^\r\n\t]*$/);

/** Log a notification failure loudly enough that a misconfigured key can't hide submissions. */
export function logUndelivered(tag: string, reason: unknown, submission: Record<string, unknown>) {
  console.error(`[${tag}] staff notification failed:`, reason);
  console.warn(`[${tag}] UNDELIVERED submission:`, submission);
}
