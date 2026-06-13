"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const field =
  "w-full rounded-btn border border-border bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-ring";

/**
 * "Let us know you're coming" connect card. Posts to /api/connect, which stores
 * the submission and (when configured) notifies staff. It never auto-emails the
 * visitor — outbound visitor copy needs explicit approval first.
 */
export function ConnectForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company) return; // honeypot
    setStatus("loading");
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
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
        <p className="font-display text-xl font-semibold">See you soon! 🎉</p>
        <p className="mt-2 text-muted">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-card border border-border bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className="mb-1 block text-sm font-medium">Name <span className="text-cta">*</span></label>
          <input id="cf-name" name="name" required autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor="cf-email" className="mb-1 block text-sm font-medium">Email <span className="text-cta">*</span></label>
          <input id="cf-email" name="email" type="email" required autoComplete="email" className={field} />
        </div>
        <div>
          <label htmlFor="cf-phone" className="mb-1 block text-sm font-medium">Phone <span className="text-muted">(optional)</span></label>
          <input id="cf-phone" name="phone" type="tel" autoComplete="tel" className={field} />
        </div>
        <div>
          <label htmlFor="cf-date" className="mb-1 block text-sm font-medium">When are you planning to visit?</label>
          <input id="cf-date" name="visitDate" type="date" className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="cf-msg" className="mb-1 block text-sm font-medium">Anything we should know? <span className="text-muted">(optional)</span></label>
        <textarea id="cf-msg" name="message" rows={3} className={field} />
      </div>
      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {status === "error" && <p role="alert" className="text-sm text-cta">{message}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Sending…" : "Let us know you're coming"}
        </Button>
        <p className="text-xs text-muted">We&apos;ll have someone ready to greet you.</p>
      </div>
    </form>
  );
}
