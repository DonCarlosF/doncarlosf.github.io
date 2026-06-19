import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Section";

export function PageHeader({
  eyebrow, title, intro, children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface-2">
      <Container className="py-14 sm:py-16 lg:py-20">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="kbcf-section-title max-w-3xl text-balance text-4xl font-semibold sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-muted">{intro}</p>}
        {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
      </Container>
    </header>
  );
}
