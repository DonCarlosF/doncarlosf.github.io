"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level boundary: Header/Footer stay mounted; only the page body shows the fallback.
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Something went wrong</p>
      <h1 className="font-display text-4xl font-semibold">This page hit a snag.</h1>
      <p className="max-w-md text-muted">Please try again in a moment. The rest of the site is still available.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg"
        >
          Try again
        </button>
        <Link href="/" className="rounded-btn border border-border px-5 py-2.5 text-sm font-semibold">Go home</Link>
      </div>
    </div>
  );
}
