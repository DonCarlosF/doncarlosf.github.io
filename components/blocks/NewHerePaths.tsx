import Link from "next/link";
import { HeartHandshake, Compass, MessageCircle, Sparkles, ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";

/** Action Pathways — the four ways to take a next step at KBCF. */
const PATHS = [
  { icon: HeartHandshake, title: "Join Us!", body: "Plan your first visit, find service times, and know exactly what to expect.", href: "/new-here", cta: "Plan a visit" },
  { icon: Compass, title: "New Here?", body: "Get to know who we are — a church like no other in the heart of Oakland.", href: "/about", cta: "About KBCF" },
  { icon: MessageCircle, title: "Get Connected", body: "Find your people — life groups and ministries across the KBCF family.", href: "/groups", cta: "Find a group" },
  { icon: Sparkles, title: "Make an Impact", body: "Serve your city through the Dream Center and our outreach across Oakland.", href: "/dream-center", cta: "Serve & give" },
];

export function NewHerePaths() {
  return (
    <Section id="new-here">
      <SectionHeading
        eyebrow="Take your next step"
        title="However you found us, there's a place for you."
        intro="Pick the path that fits where you are today — we'd love to walk it with you."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
