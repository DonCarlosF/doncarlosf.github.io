import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { SANITY_TAG } from "@/lib/content";

/**
 * On-demand revalidation for Sanity publishes. Configure a Sanity webhook
 * (API → Webhooks) to POST here on create/update/delete with the header
 * `x-revalidate-secret: <SANITY_REVALIDATE_SECRET>`. Edits then go live in
 * seconds instead of waiting for the 60s revalidation window.
 */
export async function POST(req: Request) {
  const expected = process.env.SANITY_REVALIDATE_SECRET;
  const given = req.headers.get("x-revalidate-secret") ?? "";
  const ok =
    !!expected &&
    expected.length === given.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  if (!ok) return Response.json({ ok: false }, { status: 401 });

  revalidateTag(SANITY_TAG, "max");
  return Response.json({ ok: true, revalidated: SANITY_TAG });
}
