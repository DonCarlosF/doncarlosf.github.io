import { Hero } from "@/components/blocks/Hero";
import { ServiceTimesBar } from "@/components/blocks/ServiceTimesBar";
import { NewHerePaths } from "@/components/blocks/NewHerePaths";
import { LatestSermon } from "@/components/blocks/LatestSermon";
import { UpcomingEvents } from "@/components/blocks/UpcomingEvents";
import { DreamCenterHighlight } from "@/components/blocks/DreamCenterHighlight";
import { GivingBlock } from "@/components/blocks/GivingBlock";
import { Testimonials } from "@/components/blocks/Testimonials";
import { getSiteSettings, getLatestSermon, getUpcomingEvents, getTestimonials, dreamCenter } from "@/lib/content";

export default async function HomePage() {
  const [settings, sermon, events, testimonials] = await Promise.all([
    getSiteSettings(),
    getLatestSermon(),
    getUpcomingEvents(4),
    getTestimonials(),
  ]);

  return (
    <>
      <Hero settings={settings} />
      <ServiceTimesBar settings={settings} />
      <NewHerePaths />
      <LatestSermon sermon={sermon} liveId={settings.boxcastId} />
      <UpcomingEvents events={events} />
      <Testimonials testimonials={testimonials} />
      <DreamCenterHighlight mission={dreamCenter.mission} />
      <GivingBlock />
    </>
  );
}
