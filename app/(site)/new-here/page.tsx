import type { Metadata } from "next";
import { Car, Shirt, Clock, Coffee } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConnectForm } from "@/components/forms/ConnectForm";
import { getSiteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "New Here",
  description: "Planning your first visit to KBCF? Here's what to expect — parking, what to wear, and how to connect.",
};

const EXPECT = [
  { icon: Clock, title: "How long?", body: "Plan for about 90 minutes of worship, teaching, and a warm welcome." },
  { icon: Shirt, title: "What to wear", body: "Come as you are. You'll see everything from suits to sneakers — no dress code." },
  { icon: Car, title: "Parking", body: "Parking is available near 1431 17th Avenue. Look for our team to point you in." },
  { icon: Coffee, title: "First impressions", body: "Stop by the welcome area — we'd love to meet you and answer any questions." },
];

export default async function NewHerePage() {
  const settings = await getSiteSettings();
  const sunday = settings.serviceTimes.find((s) => s.day === "Sunday");

  return (
    <>
      <PageHeader
        eyebrow="New here?"
        title="We saved you a seat."
        intro={`However you found us, we'd love to meet you${sunday ? ` this Sunday at ${sunday.time}` : ""}. Here's everything you need to walk in with confidence.`}
      >
        <Button href="#connect" size="lg">Let us know you&apos;re coming</Button>
        <Button href="/watch" size="lg" variant="outline">Watch online first</Button>
      </PageHeader>

      <Section>
        <SectionHeading eyebrow="What to expect" title="Your first visit, no surprises." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EXPECT.map((e) => (
            <Card key={e.title} className="h-full">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <e.icon size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{e.title}</h3>
              <p className="mt-2 text-sm text-muted">{e.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="connect">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="Connect"
            title="Let us know you're coming."
            intro="No pressure — just a heads up so we can look out for you and have someone ready to say hello."
          />
          <ConnectForm />
        </div>
      </Section>
    </>
  );
}
