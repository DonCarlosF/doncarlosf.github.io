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
  heroVideoUrl?: string;   // optional hero background video (muted loop)
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

export type Clip = {
  _id: string;
  hook: string;          // short hook text
  caption?: string;
  videoUrl?: string;     // vertical video
  thumbnail?: Img;
  platform?: "instagram" | "tiktok" | "youtube" | "facebook";
  hashtags?: string[];
  viralityScore?: number; // 0-100, from the clip tool
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

export type Testimonial = {
  _id: string;
  quote: string;
  attribution: string;
  image?: Img;
};

/** Editable homepage / generic page blocks live under `page`. */
export type Page = {
  _id: string;
  title: string;
  slug: string;
  blocks?: unknown[];
};
