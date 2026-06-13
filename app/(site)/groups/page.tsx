import type { Metadata } from "next";
import { Users, MapPin, Clock } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SmartImage } from "@/components/ui/Media";
import { getGroups } from "@/lib/content";

export const metadata: Metadata = {
  title: "Groups",
  description: "Life is better connected. Find a group at Kingdom Builders Christian Fellowship.",
};

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <>
      <PageHeader
        eyebrow="Groups"
        title="You weren't meant to do life alone."
        intro="Groups are where faith gets personal and friendships go deep. Find one that fits your life."
      >
        <Button href="/contact">Need help finding a group?</Button>
      </PageHeader>

      <Section>
        {groups.length === 0 ? (
          <EmptyState title="Groups are coming soon" body="Add groups in the CMS or connect Planning Center Groups." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g._id} className="flex h-full flex-col overflow-hidden p-0">
                <SmartImage image={g.image || { alt: g.name, placeholder: true }} ratio="aspect-[16/10]" rounded="rounded-none" />
                <div className="flex flex-1 flex-col p-6">
                  {g.type && (
                    <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Users size={12} aria-hidden /> {g.type}
                    </span>
                  )}
                  <h2 className="font-display text-lg font-semibold">{g.name}</h2>
                  {g.description && <p className="mt-2 flex-1 text-sm text-muted">{g.description}</p>}
                  <dl className="mt-3 space-y-1 text-sm text-muted">
                    {g.schedule && <div className="flex items-center gap-2"><Clock size={14} aria-hidden /> {g.schedule}</div>}
                    {g.location && <div className="flex items-center gap-2"><MapPin size={14} aria-hidden /> {g.location}</div>}
                  </dl>
                  <div className="mt-5">
                    <Button href={g.joinUrl || "/contact"} variant="outline" size="sm">Join this group</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
