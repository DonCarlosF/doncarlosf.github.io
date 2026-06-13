import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ email: z.string().email().max(200) });

/**
 * Mailing-list signup. Intentionally NOT wired to a provider yet — no email is
 * sent and no list is touched until Mailchimp/ConvertKit is connected and the
 * opt-in copy is approved. We validate and acknowledge interest only.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please enter a valid email." }, { status: 422 });
  }

  console.info("[subscribe] interest received (provider not connected):", parsed.data.email);

  return NextResponse.json({
    ok: true,
    message: "Thanks! Newsletter sign-ups go live as soon as our email provider is connected.",
  });
}
