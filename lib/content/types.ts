/**
 * Content model types for KBCF.
 *
 * These mirror the Sanity schemas in /sanity/schemaTypes and are the single
 * shape the UI consumes — whether data comes from Sanity (when configured) or
 * from the local seed (lib/content/seed.ts) used for the preview deploy.
 */

export type Img = {
  src?: string;       // resolved URL (seed) — Sanity images resolve via urlFor()
  alt: string;        // alt text is REQUIRED everywhere for WCAG 2.1 AA
  placeholder?: boolean; // true => render a labeled placeholder, never a fake photo
};

export type ServiceTime = {
  day: string;        // e.g. "Sunday"
  label: string;      // e.g. "Worship"
  time?: string;      // e.g. "9:00 AM" — optional: some services have no fixed clock time
  phone?: string;     // dial-in number for call-in gatherings (e.g. the prayer line)
  passcode?: string;  // dial-in passcode, if any
};

export type SocialLink = {
  platform: "instagram" | "facebook" | "youtube" | "tiktok" | "x" | "boxcast";
  url: string;
};

export type SiteSettings = {
  churchName: string;
  tagline: string;
  mission: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone?: string;       // unknown facts left undefined => UI shows placeholder
  email?: string;
  serviceTimes: ServiceTime[];
  boxcastId: string;
  givingUrl: string;
  givingProvider: string;
  social: SocialLink[];
  mapEmbedQuery: string; // address string used to build a maps embed
};

export type Speaker = {
  _id: string;
  name: string;
  role?: string;
  image?: Img;
};

export type Series = {
  _id: string;
  title: string;
  slug: string;
  image?: Img;
  description?: string;
};

/** Clip documents are upserted by the church-clip-manager repo — the shape is a
 *  cross-repo contract (see CLIP_CONTRACT.md). */
export type ClipPlatforms = { youtube?: string; instagram?: string; tiktok?: string };
export type Clip = {
  _id: string;
  hook: string;            // short hook text
  caption?: string;
  sermonDate?: string;     // YYYY-MM-DD (rail sorts by this, newest first)
  scriptureRefs?: string[];
  platforms?: ClipPlatforms; // post URLs where the clip is published
  verticalVideoUrl?: string; // optional MP4 asset URL
  thumbnail?: Img;
  hashtags?: string[];
  viralityScore?: number;  // 0-100, from the clip tool
  status?: "scheduled" | "published"; // rail renders only "published"
};

export type Sermon = {
  _id: string;
  title: string;
  slug: string;
  date: string;            // ISO
  speaker?: Speaker;
  series?: Series;
  scriptureRefs?: string[];
  videoUrl?: string;
  boxcastId?: string;
  description?: string;
  thumbnail?: Img;
  clips?: Clip[];
  sample?: boolean;        // flags seeded placeholder content
};

export type ChurchEvent = {
  _id: string;
  title: string;
  slug: string;
  start: string;           // ISO datetime
  end?: string;
  allDay?: boolean;
  recurrence?: string;     // human-readable, e.g. "Every Sunday"
  location?: string;
  description?: string;
  registrationUrl?: string;
  image?: Img;
  source?: "cms" | "planningcenter";
  sample?: boolean;
};

export type Group = {
  _id: string;
  name: string;
  slug: string;
  type?: string;           // e.g. "Life Group", "Men", "Women", "Youth"
  schedule?: string;
  location?: string;
  description?: string;
  joinUrl?: string;
  image?: Img;
  sample?: boolean;
};

export type Leader = {
  _id: string;
  name: string;
  role: string;
  bio?: string;
  bioPlaceholder?: boolean; // true => bio is awaiting approved copy
  image?: Img;
  order?: number;
};

export type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  date: string;
  excerpt?: string;
  author?: { name: string; image?: Img };
  category?: string;
  coverImage?: Img;
  body?: unknown;          // Portable Text (Sanity) — sample uses plain string
  bodyText?: string;
  sample?: boolean;
};

/** Dream Center outreach program with its real impact stat. */
export type OutreachProgram = {
  _id: string;
  name: string;
  description?: string;
  stat?: string;      // e.g. "500+"
  statLabel?: string; // e.g. "households served weekly"
  schedule?: string;  // e.g. "Thursdays 11 AM"
  serveCta?: string;
  image?: Img;
  order?: number;
};

export type Testimonial = {
  _id: string;
  quote: string;
  attribution: string;
  image?: Img;
};

/** Home page content (CMS singleton `homePage`, with a seed fallback). */
export type HeroSlide = {
  eyebrow?: string;
  title?: string;
  accent?: string;   // emphasized phrase, rendered with the theme hero-accent treatment
  ctaLabel?: string;
  ctaHref?: string;
};

export type EventBanner = {
  enabled?: boolean;
  title: string;
  date?: string;     // human-readable, editable (e.g. "May 8, 2024")
  location?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type HomeContent = {
  heroSlides: HeroSlide[];
  eventBanner?: EventBanner;
  welcomeHeading: string;
  welcomeBody: string;
  pastorsHeading: string;
  pastorsBody: string;
  pastorsImage?: Img;
};

/** About page content (CMS singleton `aboutPage`, with a seed fallback). */
export type Belief = { name: string; body: string };   // Five Pillars of Christianity
export type CoreValue = { title: string; body: string };

export type AboutContent = {
  intro: string;
  mission: string;
  storyHeading?: string;
  story?: string;
  storyPlaceholder?: boolean;
  beliefs: Belief[];
  coreValues: CoreValue[];
};

