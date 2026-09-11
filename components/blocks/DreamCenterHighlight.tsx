import { HandHeart, ArrowRight } from "lucide-react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";
import { dreamCenter } from "@/lib/content";
import type { Img } from "@/lib/content/types";

export function DreamCenterHighlight({ mission, image }: { mission: string; image?: Img }) {
  return (
    <Section tone="surface">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <SmartImage image={image ?? { alt: "Dream Center serving the Oakland community", placeholder: true }} ratio="aspect-[4/3]" />
        <div>
          <Eyebrow>The Oakland Dream Center</Eyebrow>
          <h2 className="mt-2 inline-flex items-center gap-3 font-display text-3xl font-semibold sm:text-4xl">
            <HandHeart className="text-primary" aria-hidden /> Housing · Health · Hunger
          </h2>
          <p className="mt-4 text-lg text-muted">{mission}</p>
          <p className="mt-5">
            <span className="font-display text-4xl font-semibold text-primary">{dreamCenter.headlineStat}</span>
            <span className="ml-2 text-sm font-medium uppercase tracking-wide text-muted">{dreamCenter.headlineStatLabel}</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/dream-center">Explore the Dream Center <ArrowRight size={16} aria-hidden /></Button>
            <Button href="/dream-center#volunteer" variant="outline">Serve / Volunteer</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
