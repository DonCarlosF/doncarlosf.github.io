import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/Media";
import { getAboutPage, getLeaders } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: "The story, beliefs, mission, and leadership of Kingdom Builders Christian Fellowship in Oakland, CA.",
};

export default async function AboutPage() {
  const [about, leaders] = await Promise.all([getAboutPage(), getLeaders()]);

  return (
    <>
      <PageHeader eyebrow="About KBCF" title="A Church Like No Other" intro={about.intro} />

      {/* Mission */}
      <Section tone="surface-2">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Our Mission</Eyebrow>
          <p className="mt-4 text-balance font-display text-2xl leading-snug sm:text-3xl">{about.mission}</p>
        </div>
      </Section>

      {/* Meet our pastors */}
      <Section id="leadership">
        <SectionHeading eyebrow="Leadership" title="Meet our pastors" />
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {leaders.map((l) => (
            <article key={l._id} className="group flex flex-col gap-5 sm:flex-row">
              <div className="sm:w-44 sm:shrink-0">
                <SmartImage
                  image={l.image ?? { alt: l.name, placeholder: true }}
                  ratio="aspect-square"
                  rounded="rounded-card"
                  imageClassName="transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">{l.name}</h3>
                <p className="text-sm font-medium text-primary">{l.role}</p>
                {l.bio && <p className="mt-3 text-sm leading-relaxed text-muted">{l.bio}</p>}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Our Story */}
      <Section tone="surface-2" id="story">
        <SectionHeading eyebrow="Our journey" title={about.storyHeading ?? "Our Story"} />
        {about.story ? (
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">{about.story}</p>
        ) : (
          <div className="mt-6 flex items-start gap-4 rounded-card border border-dashed border-border bg-surface p-6">
            <BookOpen className="mt-1 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Our full story is on the way.</p>
              <p className="mt-1 text-sm text-muted">
                The pastoral team is preparing this section — it can be added any time in the CMS.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* Our beliefs — Five Pillars */}
      <Section id="beliefs">
        <SectionHeading eyebrow="What we believe" title="The Five Pillars of Christianity" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {about.beliefs.map((b, i) => (
            <Card key={b.name} className="h-full">
              <span className="font-display text-sm font-bold tracking-wider text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold">{b.name}</h3>
              <p className="mt-2 leading-relaxed text-muted">{b.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Core values */}
      <Section tone="surface-2">
        <SectionHeading eyebrow="How we live it out" title="Our Core Values" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {about.coreValues.map((v) => (
            <Card key={v.title} className="h-full">
              <h3 className="font-display text-lg font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section tone="surface">
        <div className="rounded-card bg-primary px-6 py-12 text-center text-primary-fg sm:py-14">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Curious what a Sunday is like?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-fg/85">
            Here&apos;s exactly what to expect on your first visit — no surprises, no pressure.
          </p>
          <div className="mt-6">
            <Button href="/new-here" variant="accent">What to expect</Button>
          </div>
        </div>
      </Section>
    </>
  );
}
