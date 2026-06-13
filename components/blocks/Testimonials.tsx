import { Quote } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import type { Testimonial } from "@/lib/content/types";

/**
 * Renders only when real, CMS-entered testimonials exist — so the page never
 * shows stale or invented quotes (the old site's problem).
 */
export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  if (!testimonials.length) return null;
  return (
    <Section tone="surface-2">
      <SectionHeading eyebrow="Stories" title="Lives changed here." />
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t._id} delay={i * 80}>
            <figure className="flex h-full flex-col rounded-card border border-border bg-surface p-6">
              <Quote className="text-accent" aria-hidden />
              <blockquote className="mt-3 flex-1 text-lg leading-relaxed">{t.quote}</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-primary">{t.attribution}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
