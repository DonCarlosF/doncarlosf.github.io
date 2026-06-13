import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "cta" | "accent" | "outline" | "ghost" | "onDark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:-translate-y-0.5 hover:shadow-lg",
  cta: "bg-cta text-cta-fg hover:-translate-y-0.5 hover:shadow-lg",
  accent: "bg-accent text-accent-fg hover:-translate-y-0.5",
  outline: "border border-border text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  onDark: "border border-white/50 text-white hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-6 py-3.5 text-base",
};

type ButtonProps = {
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement> &
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ href, variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (href) {
    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    if (/^https?:\/\//.test(href)) {
      return (
        <a href={href} className={classes} target="_blank" rel="noopener noreferrer" {...anchorProps}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
