import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).optional().or(z.literal("")),
  email: z.string().email().max(200),
  phone: z.string().min(1).max(40),
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
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ");

  if (staffEmail && resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.STAFF_FROM_EMAIL || "KBCF Website <onboarding@resend.dev>",
          to: [staffEmail],
          subject: `New Dream Center volunteer: ${name}`,
          text: [`Name: ${name}`, `Email: ${data.email}`, `Phone: ${data.phone}`].join("\n"),
        }),
      });
    } catch {
      // Don't fail the volunteer's submission if the notification fails.
    }
  } else {
    // Not configured yet — log server-side so nothing is silently lost.
    console.info("[volunteer] submission received (staff email not configured):", {
      name, email: data.email, phone: data.phone,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Thank you for signing up to serve — our Dream Center team will be in touch soon!",
  });
}
