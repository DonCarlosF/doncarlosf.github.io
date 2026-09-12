import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { guard, line, logUndelivered } from "@/lib/api/guard";

const schema = z.object({
  name: line(120).min(1),
  email: z.email().max(200),
  phone: line(40).optional(),
  visitDate: line(40).optional(),
  message: z.string().trim().max(2000).optional(),
  company: z.string().optional(), // honeypot
});

/**
 * Connect-form handler. Stores/forwards the submission to STAFF only.
 * - Honeypot + validation for spam protection.
 * - Notifies staff via Resend only if RESEND_API_KEY + STAFF_EMAIL are set.
 * - NEVER emails the visitor (visitor-facing copy needs approval first).
 */
export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please check the form and try again." }, { status: 422 });
  }
  const data = parsed.data;

  // Honeypot tripped → pretend success, do nothing.
  if (data.company) return NextResponse.json({ ok: true, message: "Thanks!" });

  const staffEmail = process.env.STAFF_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  const summary = { name: data.name, email: data.email, visitDate: data.visitDate };

  if (staffEmail && resendKey) {
    // Runs after the response is sent, so the visitor never waits on Resend.
    after(async () => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.STAFF_FROM_EMAIL || "KBCF Website <onboarding@resend.dev>",
            to: [staffEmail],
            reply_to: data.email,
            subject: `New visitor connect: ${data.name}`.slice(0, 150),
            text: [
              `Name: ${data.name}`,
              `Email: ${data.email}`,
              data.phone ? `Phone: ${data.phone}` : "",
              data.visitDate ? `Planning to visit: ${data.visitDate}` : "",
              data.message ? `Message: ${data.message}` : "",
            ].filter(Boolean).join("\n"),
          }),
        });
        if (!res.ok) logUndelivered("connect", `${res.status} ${await res.text().catch(() => "")}`, summary);
      } catch (err) {
        logUndelivered("connect", err, summary);
      }
    });
  } else {
    // Not configured yet — log server-side so nothing is silently lost.
    console.info("[connect] submission received (staff email not configured):", summary);
  }

  return NextResponse.json({
    ok: true,
    message: "We've got it — our team will be ready to welcome you. See you soon!",
  });
}
