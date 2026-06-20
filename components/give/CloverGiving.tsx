import { Button } from "@/components/ui/Button";
import { HeartHandshake, ShieldCheck, ArrowRight } from "lucide-react";

/**
 * Secure giving panel. Clover's hosted pay page sets
 * `frame-ancestors *.clover.com`, so it cannot be embedded in an iframe on our
 * domain — the browser blocks it. Instead we send givers to Clover's secure
 * page in a new tab (the standard, PCI-safe pattern for hosted checkout).
 * Provider-agnostic: the URL + provider name come from siteSettings.
 */
export function CloverGiving({ url, provider = "Clover" }: { url: string; provider?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-8 text-center sm:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-primary">
        <HeartHandshake aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold sm:text-3xl">Give securely online</h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Make a one-time or recurring gift in just a few taps. You&apos;ll be taken to our secure{" "}
        {provider} giving page in a new tab.
      </p>
      <div className="mt-6 flex justify-center">
        <Button href={url} size="lg" variant="cta">
          Give Now <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
      <p className="mt-5 inline-flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck size={14} aria-hidden /> Secure giving powered by {provider}
      </p>
    </div>
  );
}
