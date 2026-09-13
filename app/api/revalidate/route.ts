import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { SANITY_TAG } from "@/lib/content";

/**
 * On-demand revalidation for Sanity publishes. Configure a Sanity webhook
 * (API → Webhooks) to POST here on create/update/delete with the header
 * `x-revalidate-secret: <SANITY_REVALIDATE_SECRET>`. Edits then go live in
 * seconds instead of waiting out the revalidation window in lib/content.
 */
export async function POST(req: Request) {
  const expected = Buffer.from(process.env.SANITY_REVALIDATE_SECRET ?? "");
  const given = Buffer.from(req.headers.get("x-revalidate-secret") ?? "");
  // Compare byte lengths, not string lengths: a same-length non-ASCII header
  // would otherwise reach timingSafeEqual with mismatched buffers and throw.
  const ok = expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
  if (!ok) return Response.json({ ok: false }, { status: 401 });

  // expire: 0, not "max" — a webhook caller wants the stale copy gone now, so
  // the editor's first reload shows the change instead of the one after it.
  revalidateTag(SANITY_TAG, { expire: 0 });
  return Response.json({ ok: true, revalidated: SANITY_TAG });
}
