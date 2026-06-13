"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Mailing-list signup. Posts to /api/subscribe, which is intentionally NOT wired
 * to send anything until a provider (Mailchimp/ConvertKit) is connected and
 * approved. No email is transmitted to anyone in the meantime.
 */
export function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("company")) return; // honeypot
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email") }),
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
    return <p className="text-sm text-muted">{message}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input
        id="nl-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@email.com"
        className="min-w-0 flex-1 rounded-btn border border-border bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-ring"
      />
      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Button type="submit" variant="primary" size="sm" disabled={status === "loading"}>
        {status === "loading" ? "…" : "Subscribe"}
      </Button>
      {status === "error" && <p className="mt-1 text-xs text-cta sm:w-full">{message}</p>}
    </form>
  );
}
