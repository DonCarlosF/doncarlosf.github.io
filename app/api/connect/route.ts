import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().or(z.literal("")),
  visitDate: z.string().max(40).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  company: z.string().optional(), // honeypot
});

/**
 * Connect-form handler. Stores/forwards the submission to STAFF only.
 * - Honeypot + validation for spam protection.
 * - Notifies staff via Resend only if RESEND_API_KEY + STAFF_EMAIL are set.
 * - NEVER emails the visitor (visitor-facing copy needs approval first).
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

  if (staffEmail && resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.STAFF_FROM_EMAIL || "KBCF Website <onboarding@resend.dev>",
          to: [staffEmail],
          subject: `New visitor connect: ${data.name}`,
          text: [
            `Name: ${data.name}`,
            `Email: ${data.email}`,
            data.phone ? `Phone: ${data.phone}` : "",
            data.visitDate ? `Planning to visit: ${data.visitDate}` : "",
            data.message ? `Message: ${data.message}` : "",
          ].filter(Boolean).join("\n"),
        }),
      });
    } catch {
      // Don't fail the visitor's submission if the notification fails.
    }
  } else {
    // Not configured yet — log server-side so nothing is silently lost.
    console.info("[connect] submission received (staff email not configured):", {
      name: data.name, email: data.email, visitDate: data.visitDate,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "We've got it — our team will be ready to welcome you. See you soon!",
  });
}
