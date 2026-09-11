import type { Metadata } from "next";
import { MapPin, Phone, PhoneCall, Mail, Clock, Navigation } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ConnectForm } from "@/components/forms/ConnectForm";
import { MapEmbed } from "@/components/map/MapEmbed";
import { getSiteSettings } from "@/lib/content";
import { serviceLabelTime } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Kingdom Builders Christian Fellowship in Oakland, CA.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const { address } = settings;
  const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
  const directionsHref = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;

  return (
    <>
      <PageHeader eyebrow="Contact" title="We'd love to hear from you." intro="Questions, prayer requests, or planning a visit — reach out any time." />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title="Visit us" />
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
                <span>{fullAddress}</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
                <span>{settings.serviceTimes.map((s) => `${s.day} ${serviceLabelTime(s)}`).join(" · ")}</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
                <span>{settings.phone || "Phone — add in CMS"}</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
                <span>{settings.email || "Email — add in CMS"}</span>
              </li>
            </ul>

            {settings.serviceTimes
              .filter((s) => s.phone)
              .map((s) => {
                const digits = s.phone!.replace(/\D/g, "");
                const tel = digits.length === 10 ? `+1${digits}` : `+${digits}`;
                return (
                  <div key={`${s.day}-${s.label}`} className="mt-6 rounded-card border border-border bg-surface-2 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <PhoneCall size={16} className="text-primary" aria-hidden /> {s.label} · {s.day}
                      {s.time ? ` · ${s.time}` : ""}
                    </p>
                    <p className="mt-1.5 text-sm text-muted">
                      Call{" "}
                      <a href={`tel:${tel}`} className="font-semibold text-primary underline underline-offset-2">
                        {s.phone}
                      </a>
                      {s.passcode ? (
                        <>
                          , passcode <span className="font-semibold text-fg">{s.passcode}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                );
              })}

            <div className="mt-6">
              <Button href={directionsHref} variant="outline"><Navigation size={16} aria-hidden /> Get directions</Button>
            </div>
            <div className="mt-6">
              <MapEmbed query={settings.mapEmbedQuery} />
            </div>
          </div>

          <div>
            <SectionHeading title="Send us a message" />
            <p className="mt-3 text-sm text-muted">We&apos;ll get back to you as soon as we can.</p>
            <div className="mt-6">
              <ConnectForm />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
