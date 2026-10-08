import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, readJson } from "@/lib/api/guard";

const schema = z.object({ email: z.email().max(200) });

/**
 * Mailing-list signup. Intentionally NOT wired to a provider yet — no email is
 * sent and no list is touched until Mailchimp/ConvertKit is connected and the
 * opt-in copy is approved. We validate and acknowledge interest only.
 */
export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const body = await readJson(req);
  if ("response" in body) return body.response;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please enter a valid email." }, { status: 422 });
  }

  console.info("[subscribe] interest received (provider not connected):", parsed.data.email);

  return NextResponse.json({
    ok: true,
    message: "Thanks! Newsletter sign-ups go live as soon as our email provider is connected.",
  });
}
