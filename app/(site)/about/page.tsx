import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";
import { getSiteSettings, getLeaders } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: "The story, beliefs, and leadership of Kingdom Builders Christian Fellowship in Oakland, CA.",
};

export default async function AboutPage() {
  const [settings, leaders] = await Promise.all([getSiteSettings(), getLeaders()]);

  return (
    <>
      <PageHeader
        eyebrow="About KBCF"
        title="People are our heart. Jesus is our message."
        intro={`${settings.tagline}. A contemporary, Gospel-centered family in the heart of Oakland.`}
      />

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Our story</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Built on the Gospel, for the Bay.</h2>
            <p className="mt-4 text-lg text-muted">
              Kingdom Builders Christian Fellowship was founded in 2009 by Pastor L.J. Jennings and Karen Jennings,
              after more than 20 years of ministry across the Bay Area. The message is sacred — the method is not.
            </p>
            <p className="mt-4 text-muted">
              [Placeholder — add the full, approved church story here in the CMS.]
            </p>
            <div className="mt-6">
              <Button href="/new-here">Plan your first visit</Button>
            </div>
          </div>
          <SmartImage image={{ alt: "The KBCF family gathered for worship", placeholder: true }} ratio="aspect-[4/3]" />
        </div>
      </Section>

      <Section tone="surface-2" id="beliefs">
        <SectionHeading eyebrow="What we believe" title="Our beliefs" />
        <div className="mt-8 flex items-start gap-4 rounded-card border border-dashed border-border bg-surface p-6">
          <BookOpen className="mt-1 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-medium">Statement of faith — awaiting approved copy.</p>
            <p className="mt-1 text-sm text-muted">
              Doctrine and the statement of faith will be supplied by KBCF and added in the CMS. (We don&apos;t write
              theology on the church&apos;s behalf.)
            </p>
          </div>
        </div>
      </Section>

      <Section id="leadership">
        <SectionHeading eyebrow="Leadership" title="Meet our pastors" />
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {leaders.map((l) => (
            <article key={l._id} className="flex flex-col gap-5 sm:flex-row">
              <div className="sm:w-44 sm:shrink-0">
                <SmartImage image={l.image || { alt: l.name, placeholder: true }} ratio="aspect-square" rounded="rounded-card" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">{l.name}</h3>
                <p className="text-sm font-medium text-primary">{l.role}</p>
                {l.bio && <p className="mt-3 text-sm text-muted">{l.bio}</p>}
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <div className="rounded-card bg-primary px-6 py-12 text-center text-primary-fg sm:py-14">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Curious what a Sunday is like?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-fg/85">
            Here&apos;s exactly what to expect on your first visit — no surprises, no pressure.
          </p>
          <div className="mt-6">
            <Button href="/new-here" variant="accent" className="hero-cta-primary">What to expect</Button>
          </div>
        </div>
      </Section>
    </>
  );
}
