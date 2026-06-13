import type { Metadata } from "next";
import { Repeat, HandCoins, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { CloverGiving } from "@/components/give/CloverGiving";
import { getSiteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Give",
  description: "Your generosity is changing lives. Give securely to Kingdom Builders Christian Fellowship.",
};

export default async function GivePage() {
  const settings = await getSiteSettings();

  return (
    <>
      <PageHeader
        eyebrow="Giving"
        title="Your generosity is changing lives."
        intro="From this house to the Dream Center and across Oakland — every gift moves the mission forward. Give securely below."
      >
        <Button href={settings.givingUrl} size="lg" variant="cta">Give Now</Button>
        <Button href="#ways" size="lg" variant="outline">Other ways to give</Button>
      </PageHeader>

      <Section>
        <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <CloverGiving url={settings.givingUrl} />

          <div id="ways" className="space-y-6">
            <div className="rounded-card border border-border bg-surface p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Repeat size={18} className="text-primary" aria-hidden /> Make it recurring
              </h2>
              <p className="mt-2 text-sm text-muted">
                Set up weekly or monthly giving in the secure form so faithful generosity is one less thing to remember.
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <HandCoins size={18} className="text-primary" aria-hidden /> Other ways to give
              </h2>
              <p className="mt-2 text-sm text-muted">
                Give in person on the weekend, or by mail to {settings.address.street}, {settings.address.city},{" "}
                {settings.address.state} {settings.address.zip}.
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <ShieldCheck size={18} className="text-primary" aria-hidden /> Secure &amp; accountable
              </h2>
              <p className="mt-2 text-sm text-muted">
                Gifts are processed securely through {settings.givingProvider}. Questions about giving? We&apos;d love to help —
                reach out any time.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
