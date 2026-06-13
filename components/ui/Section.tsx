import { cn } from "@/lib/utils/cn";
import { Container } from "./Container";

type Tone = "default" | "surface" | "surface-2" | "primary";

const tones: Record<Tone, string> = {
  default: "bg-bg text-fg",
  surface: "bg-surface text-fg",
  "surface-2": "bg-surface-2 text-fg",
  primary: "bg-primary text-primary-fg",
};

export function Section({
  children, className, tone = "default", id, contain = true,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  id?: string;
  contain?: boolean;
}) {
  return (
    <section id={id} className={cn("py-16 sm:py-20 lg:py-24", tones[tone], className)}>
      {contain ? <Container>{children}</Container> : children}
    </section>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-[0.22em] text-primary", className)}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow, title, intro, className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h2 className="text-balance text-3xl font-semibold sm:text-4xl lg:text-[2.75rem]">{title}</h2>
      {intro && <p className="mt-4 text-lg text-muted">{intro}</p>}
    </div>
  );
}
