import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/new-here", label: "Plan your visit" },
  { href: "/watch", label: "Watch" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

/** Shared 404 copy. The site layout supplies the header when this renders inside it. */
export function NotFoundMessage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">404</p>
      <h1 className="font-display text-4xl font-semibold">We couldn&apos;t find that page.</h1>
      <p className="max-w-md text-muted">The link may be old or moved. Try one of these.</p>
      <ul className="mt-2 flex flex-wrap justify-center gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex rounded-btn border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
