import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { guard, line, logUndelivered, readJson } from "@/lib/api/guard";

const schema = z.object({
  firstName: line(120).min(1),
  lastName: line(120).optional(),
  email: z.email().max(200),
  phone: line(40).min(1),
  company: z.string().optional(), // honeypot
});

/**
 * Dream Center volunteer-form handler. Stores/forwards to STAFF only.
 * - Honeypot + validation for spam protection.
 * - Notifies staff via Resend only if RESEND_API_KEY + STAFF_EMAIL are set;
 *   otherwise logs server-side so nothing is silently lost.
 * - NEVER emails the volunteer.
 */
export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const body = await readJson(req);
  if ("response" in body) return body.response;

  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please check the form and try again." }, { status: 422 });
  }
  const data = parsed.data;

  // Honeypot tripped → pretend success, do nothing.
  if (data.company) return NextResponse.json({ ok: true, message: "Thanks!" });

  const staffEmail = process.env.STAFF_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ");
  const summary = { name, email: data.email, phone: data.phone };

  if (staffEmail && resendKey) {
    // Runs after the response is sent, so the volunteer never waits on Resend.
    after(async () => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.STAFF_FROM_EMAIL || "KBCF Website <onboarding@resend.dev>",
            to: [staffEmail],
            reply_to: data.email,
            subject: `New Dream Center volunteer: ${name}`.slice(0, 150),
            text: [`Name: ${name}`, `Email: ${data.email}`, `Phone: ${data.phone}`].join("\n"),
          }),
        });
        if (!res.ok) logUndelivered("volunteer", `${res.status} ${await res.text().catch(() => "")}`, summary);
      } catch (err) {
        logUndelivered("volunteer", err, summary);
      }
    });
  } else {
    // Not configured yet — log server-side so nothing is silently lost.
    console.info("[volunteer] submission received (staff email not configured):", summary);
  }

  return NextResponse.json({
    ok: true,
    message: "Thank you for signing up to serve — our Dream Center team will be in touch soon!",
  });
}
