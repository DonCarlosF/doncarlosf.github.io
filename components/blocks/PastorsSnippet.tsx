import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";
import type { Img } from "@/lib/content/types";

/** Home-page teaser for the pastors. Photo is a labeled placeholder until a real
 *  image is dropped in (Sanity image field or a /public path). */
export function PastorsSnippet({ heading, body, image }: { heading: string; body: string; image?: Img }) {
  return (
    <Section tone="surface-2">
      <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <SmartImage image={image ?? { alt: "Pastors LJ & Karen Jennings", placeholder: true }} ratio="aspect-[4/5]" />
        <div>
          <Eyebrow>Our Pastors</Eyebrow>
          <h2 className="kbcf-section-title mt-2 font-display text-3xl font-semibold sm:text-4xl">{heading}</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>
          <div className="mt-6">
            <Button href="/about#leadership" variant="outline">Meet our pastors</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
