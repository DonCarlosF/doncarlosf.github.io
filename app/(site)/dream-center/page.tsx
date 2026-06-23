import type { Metadata } from "next";
import { HandHeart, Gift } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/Media";
import { VolunteerForm } from "@/components/forms/VolunteerForm";
import { dreamCenter } from "@/lib/content";

export const metadata: Metadata = {
  title: "Dream Center",
  description: "The community outreach arm of Kingdom Builders Christian Fellowship, serving Oakland.",
};

export default function DreamCenterPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dream Center"
        title="Loving Oakland, in Jesus' name."
        intro={dreamCenter.mission}
      >
        <Button href="#volunteer">Serve / Volunteer</Button>
        <Button href="/give" variant="outline">Donate</Button>
      </PageHeader>

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SmartImage image={{ alt: "Dream Center volunteers serving the community", placeholder: true }} ratio="aspect-[4/3]" />
          <div>
            <Eyebrow>Our mission</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Meeting real needs, sharing real hope.</h2>
            <p className="mt-4 text-lg text-muted">{dreamCenter.mission}</p>
            <p className="mt-4 text-muted">[Placeholder — add Dream Center programs, partners, and impact in the CMS.]</p>
          </div>
        </div>
      </Section>

      <Section tone="surface-2">
        <SectionHeading eyebrow="Programs" title="How we serve" />
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {["Program one", "Program two", "Program three"].map((p) => (
            <Card key={p}>
              <HandHeart className="text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-lg font-semibold">{p}</h3>
              <p className="mt-2 text-sm text-muted">[Placeholder — describe this outreach program in the CMS.]</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="volunteer" tone="surface-2">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Get involved</Eyebrow>
            <h2 className="kbcf-section-title mt-2 font-display text-3xl font-semibold sm:text-4xl">
              {dreamCenter.volunteerHeading}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">{dreamCenter.volunteerBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/give" variant="outline"><Gift size={16} aria-hidden /> Give to outreach</Button>
            </div>
          </div>
          <VolunteerForm />
        </div>
      </Section>
    </>
  );
}
