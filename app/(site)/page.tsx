import { HeroSlider } from "@/components/blocks/HeroSlider";
import { EventBanner } from "@/components/blocks/EventBanner";
import { ServiceTimesBar } from "@/components/blocks/ServiceTimesBar";
import { WelcomeIntro } from "@/components/blocks/WelcomeIntro";
import { NewHerePaths } from "@/components/blocks/NewHerePaths";
import { PastorsSnippet } from "@/components/blocks/PastorsSnippet";
import { LatestSermon } from "@/components/blocks/LatestSermon";
import { UpcomingEvents } from "@/components/blocks/UpcomingEvents";
import { DreamCenterHighlight } from "@/components/blocks/DreamCenterHighlight";
import { GivingBlock } from "@/components/blocks/GivingBlock";
import { Testimonials } from "@/components/blocks/Testimonials";
import { getSiteSettings, getHomePage, getLatestSermon, getUpcomingEvents, getTestimonials, dreamCenter } from "@/lib/content";

export default async function HomePage() {
  const [settings, home, sermon, events, testimonials] = await Promise.all([
    getSiteSettings(),
    getHomePage(),
    getLatestSermon(),
    getUpcomingEvents(4),
    getTestimonials(),
  ]);

  return (
    <>
      <HeroSlider slides={home.heroSlides} />
      <EventBanner banner={home.eventBanner} />
      <ServiceTimesBar settings={settings} />
      <WelcomeIntro heading={home.welcomeHeading} body={home.welcomeBody} />
      <NewHerePaths />
      <PastorsSnippet heading={home.pastorsHeading} body={home.pastorsBody} image={home.pastorsImage} />
      <LatestSermon sermon={sermon} liveId={settings.boxcastId} />
      <UpcomingEvents events={events} />
      <Testimonials testimonials={testimonials} />
      <DreamCenterHighlight mission={dreamCenter.mission} />
      <GivingBlock />
    </>
  );
}
