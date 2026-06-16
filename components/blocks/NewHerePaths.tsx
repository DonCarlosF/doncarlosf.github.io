import Link from "next/link";
import { MapPin, Baby, MessageCircle, ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";

const PATHS = [
  { icon: MapPin, title: "Plan Your Visit", body: "What to expect, where to park, and what to wear (hint: come as you are).", href: "/new-here", cta: "Plan a visit" },
  { icon: Baby, title: "Kids & Family", body: "Safe, fun, age-based environments so the whole family can worship.", href: "/new-here#kids", cta: "KBCF Kids" },
  { icon: MessageCircle, title: "Let Us Know You're Coming", body: "Tell us you're on your way and we'll have someone ready to greet you.", href: "/new-here#connect", cta: "Say hello" },
];

export function NewHerePaths() {
  return (
    <Section id="new-here">
      <SectionHeading
        eyebrow="New here?"
        title="Your first Sunday, made simple."
        intro="However you found us, we'd love to meet you. Here's everything you need to walk in with confidence."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PATHS.map((p, i) => (
          <Reveal key={p.title} delay={i * 80}>
            <Card className="h-full">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <p.icon size={22} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-muted">{p.body}</p>
              <Link href={p.href} className="kbcf-more mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
                {p.cta} <ArrowRight size={16} aria-hidden />
              </Link>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
