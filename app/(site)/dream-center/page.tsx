import type { Metadata } from "next";
import { Home, HeartPulse, Utensils, Gift, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/Media";
import { VolunteerForm } from "@/components/forms/VolunteerForm";
import { dreamCenter, getOutreachPrograms } from "@/lib/content";
import { localOr } from "@/lib/content/local-images";

export const metadata: Metadata = {
  title: "Dream Center",
  description:
    "The Oakland Dream Center — KBCF's outreach arm serving Housing, Health, and Hunger: 500+ households fed weekly, and more.",
};

const THREE_HS = [
  { icon: Home, name: "Housing", blurb: "From a men's sober-living home to affordable housing on church-owned land." },
  { icon: HeartPulse, name: "Health", blurb: "Celebrate Recovery, a free health fair, and neighborhood clean-ups." },
  { icon: Utensils, name: "Hunger", blurb: "500+ households and 25,000+ lbs of food every week — plus meals on the streets." },
];

export default async function DreamCenterPage() {
  const programs = await getOutreachPrograms();

  return (
    <>
      <PageHeader eyebrow="The Oakland Dream Center" title="Loving Oakland, in Jesus' name." intro={dreamCenter.mission}>
        <Button href="#volunteer">Serve / Volunteer</Button>
        <Button href="/give" variant="outline">Donate</Button>
      </PageHeader>

      {/* The three H's */}
      <Section>
        <SectionHeading eyebrow="Our focus" title="Housing · Health · Hunger" intro="Everything the Dream Center does serves one of the three H's." />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {THREE_HS.map((h) => (
            <Card key={h.name} className="h-full">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <h.icon size={22} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-2xl font-semibold">{h.name}</h3>
              <p className="mt-2 text-sm text-muted">{h.blurb}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Programs with real stats */}
      <Section tone="surface-2">
        <SectionHeading eyebrow="Programs" title="How we serve" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p) => (
            <Card key={p._id} className="flex h-full flex-col">
              {p.stat ? (
                <p>
                  <span className="font-display text-3xl font-semibold text-primary">{p.stat}</span>
                  {p.statLabel && <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-muted">{p.statLabel}</span>}
                </p>
              ) : null}
              <h3 className={`font-display text-lg font-semibold ${p.stat ? "mt-3" : ""}`}>{p.name}</h3>
              {p.description && <p className="mt-1.5 text-sm text-muted">{p.description}</p>}
              {p.schedule && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Clock size={13} aria-hidden /> {p.schedule}
                </p>
              )}
              <div className="mt-auto pt-4">
                <Link href="#volunteer" className="kbcf-more inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
                  {p.serveCta || "Volunteer"} <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Affordable-housing impact story */}
      <Section id="housing">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SmartImage image={localOr("dream-center", { alt: "Affordable housing development rendering", placeholder: true })} ratio="aspect-[4/3]" />
          <div>
            <Eyebrow>Housing</Eyebrow>
            <h2 className="kbcf-section-title mt-2 font-display text-3xl font-semibold sm:text-4xl">{dreamCenter.housingStory.heading}</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">{dreamCenter.housingStory.body}</p>
            <div className="mt-6">
              <Button href="/give" variant="outline"><Gift size={16} aria-hidden /> Give toward the mission</Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Volunteer */}
      <Section id="volunteer" tone="surface-2">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Get involved</Eyebrow>
            <h2 className="kbcf-section-title mt-2 font-display text-3xl font-semibold sm:text-4xl">{dreamCenter.volunteerHeading}</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">{dreamCenter.volunteerBody}</p>
          </div>
          <VolunteerForm />
        </div>
      </Section>
    </>
  );
}
