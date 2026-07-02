import { HandHeart, ArrowRight } from "lucide-react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";

export function DreamCenterHighlight({ mission }: { mission: string }) {
  return (
    <Section tone="surface">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <SmartImage image={{ alt: "Dream Center serving the Oakland community", placeholder: true }} ratio="aspect-[4/3]" />
        <div>
          <Eyebrow>Dream Center</Eyebrow>
          <h2 className="mt-2 inline-flex items-center gap-3 font-display text-3xl font-semibold sm:text-4xl">
            <HandHeart className="text-primary" aria-hidden /> Love Oakland, in action.
          </h2>
          <p className="mt-4 text-lg text-muted">{mission}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/dream-center">Explore the Dream Center <ArrowRight size={16} aria-hidden /></Button>
            <Button href="/dream-center#volunteer" variant="outline">Serve / Volunteer</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
