import type { Metadata } from "next";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GroupsExplorer } from "@/components/groups/GroupsExplorer";
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
          <GroupsExplorer groups={groups} />
        )}
      </Section>
    </>
  );
}
