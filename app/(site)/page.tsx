import { Hero } from "@/components/blocks/Hero";
import { ServiceTimesBar } from "@/components/blocks/ServiceTimesBar";
import { NewHerePaths } from "@/components/blocks/NewHerePaths";
import { LatestSermon } from "@/components/blocks/LatestSermon";
import { UpcomingEvents } from "@/components/blocks/UpcomingEvents";
import { DreamCenterHighlight } from "@/components/blocks/DreamCenterHighlight";
import { GivingBlock } from "@/components/blocks/GivingBlock";
import { getSiteSettings, getLatestSermon, getUpcomingEvents, dreamCenter } from "@/lib/content";

export default async function HomePage() {
  const [settings, sermon, events] = await Promise.all([
    getSiteSettings(),
    getLatestSermon(),
    getUpcomingEvents(4),
  ]);

  return (
    <>
      <Hero settings={settings} />
      <ServiceTimesBar settings={settings} />
      <NewHerePaths />
      <LatestSermon sermon={sermon} />
      <UpcomingEvents events={events} />
      <DreamCenterHighlight mission={dreamCenter.mission} />
      <GivingBlock />
    </>
  );
}
