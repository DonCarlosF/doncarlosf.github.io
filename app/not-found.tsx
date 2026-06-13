import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">404</p>
      <h1 className="font-display text-4xl font-semibold">We couldn&apos;t find that page.</h1>
      <p className="max-w-md text-muted">The link may be old or moved. Let&apos;s get you back home.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg">Go home</Link>
        <Link href="/watch" className="rounded-btn border border-border px-5 py-2.5 text-sm font-semibold">Watch a message</Link>
      </div>
    </main>
  );
}
