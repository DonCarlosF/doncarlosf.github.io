"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const field =
  "w-full rounded-btn border border-border bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Dream Center volunteer sign-up. Posts to /api/volunteer, which notifies staff
 * (when configured) and otherwise logs server-side. Never auto-emails the
 * volunteer. Honeypot + required-field validation for spam protection.
 */
export function VolunteerForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company) return; // honeypot
    setStatus("loading");
    try {
      const res = await fetch("/api/volunteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      setStatus(res.ok ? "done" : "error");
      setMessage(json.message || (res.ok ? "Thanks!" : "Something went wrong."));
      if (res.ok) form.reset();
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-center">
        <p className="font-display text-xl font-semibold">Thank you for serving! 🙌</p>
        <p className="mt-2 text-muted">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-card border border-border bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vf-first" className="mb-1 block text-sm font-medium">First name <span className="text-cta">*</span></label>
          <input id="vf-first" name="firstName" required autoComplete="given-name" className={field} />
        </div>
        <div>
          <label htmlFor="vf-last" className="mb-1 block text-sm font-medium">Last name</label>
          <input id="vf-last" name="lastName" autoComplete="family-name" className={field} />
        </div>
        <div>
          <label htmlFor="vf-email" className="mb-1 block text-sm font-medium">Email <span className="text-cta">*</span></label>
          <input id="vf-email" name="email" type="email" required autoComplete="email" className={field} />
        </div>
        <div>
          <label htmlFor="vf-phone" className="mb-1 block text-sm font-medium">Phone number <span className="text-cta">*</span></label>
          <input id="vf-phone" name="phone" type="tel" required autoComplete="tel" className={field} />
        </div>
      </div>
      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {status === "error" && <p role="alert" className="text-sm text-cta">{message}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Sending…" : "Sign up to volunteer"}
        </Button>
        <p className="text-xs text-muted">We&apos;ll reach out with next steps.</p>
      </div>
    </form>
  );
}
