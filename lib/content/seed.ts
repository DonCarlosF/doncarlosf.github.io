/**
 * Seed content for KBCF — used for the preview deploy and as a graceful
 * fallback whenever Sanity is not yet configured.
 *
 * SOURCE-OF-TRUTH RULES (do not violate):
 *  - Only verified facts about KBCF are stated as fact.
 *  - Anything not supplied (bios, photos, phone/email, socials, sermons) is
 *    either omitted, left blank, or clearly marked `sample`/`placeholder`.
 *  - No invented testimonials, quotes, stats, or doctrine.
 */
import type {
  SiteSettings, Sermon, ChurchEvent, Group, Leader, BlogPost, Testimonial, Series, Speaker,
} from "./types";

export const siteSettings: SiteSettings = {
  churchName: "Kingdom Builders Christian Fellowship",
  tagline: "Church Like No Other",
  mission: "People are our heart and Jesus is our message.",
  address: { street: "1431 17th Avenue", city: "Oakland", state: "CA", zip: "94606" },
  // phone/email unknown — intentionally omitted so the UI shows a clear placeholder.
  phone: undefined,
  email: undefined,
  serviceTimes: [
    { day: "Saturday", label: "Morning Prayer" },
    { day: "Sunday", label: "Worship", time: "9:00 AM" },
    { day: "Wednesday", label: "Bible Study", time: "7:00 PM" },
  ],
  boxcastId: "",
  givingProvider: "Clover",
  givingUrl: "https://www.clover.com/pay-widgets/fab217bf-1afb-4bda-9d0d-085098cbadac",
  heroVideoUrl: undefined, // add an MP4/HLS hero loop in the CMS when available

  // Social handles not supplied — left empty rather than guessed.
  social: [],
  mapEmbedQuery: "1431 17th Avenue, Oakland, CA 94606",
};

const pastorLJ: Speaker = { _id: "spk-lj", name: "Pastor L.J. Jennings", role: "Founder & Senior Pastor" };

export const leaders: Leader[] = [
  {
    _id: "ldr-lj",
    name: "Pastor L.J. Jennings",
    role: "Founder & Senior Pastor",
    // Verified facts only; remainder awaits approved bio copy.
    bio: "L.J. Jennings is the Founder and Senior Pastor of Kingdom Builders Christian Fellowship, which he and Karen Jennings founded in 2009 after more than 20 years of ministry in the Bay Area. [Placeholder — add approved full bio in the CMS.]",
    bioPlaceholder: true,
    image: { alt: "Pastor L.J. Jennings", placeholder: true },
    order: 1,
  },
  {
    _id: "ldr-karen",
    name: "Karen Jennings",
    role: "Co-Founder",
    bio: "Karen Jennings co-founded Kingdom Builders Christian Fellowship alongside Pastor L.J. Jennings in 2009. [Placeholder — add approved full bio in the CMS.]",
    bioPlaceholder: true,
    image: { alt: "Karen Jennings", placeholder: true },
    order: 2,
  },
];

const sampleSeries: Series = { _id: "ser-sample", title: "Sample Series", slug: "sample-series", description: "Replace with a real series in the CMS." };

export const seriesList: Series[] = [sampleSeries];

// Sample sermons demonstrate the archive UI. Clearly flagged; nothing here is a
// real KBCF message, title, or scripture claim.
export const sermons: Sermon[] = [
  {
    _id: "srm-1",
    title: "Sample Message — Edit in Studio",
    slug: "sample-message-1",
    date: "2026-06-07T16:00:00.000Z",
    speaker: pastorLJ,
    series: sampleSeries,
    scriptureRefs: ["Scripture reference"],
    description: "This is sample sermon content to demonstrate the archive layout. Add real messages in the CMS.",
    thumbnail: { alt: "Sermon thumbnail placeholder", placeholder: true },
    sample: true,
    clips: [
      { _id: "clip-1", hook: "Hook text for a vertical clip", platform: "instagram", viralityScore: 92, thumbnail: { alt: "Clip placeholder", placeholder: true } },
      { _id: "clip-2", hook: "Another shareable moment", platform: "tiktok", viralityScore: 87, thumbnail: { alt: "Clip placeholder", placeholder: true } },
      { _id: "clip-3", hook: "Made for your feed", platform: "youtube", viralityScore: 81, thumbnail: { alt: "Clip placeholder", placeholder: true } },
    ],
  },
  {
    _id: "srm-2",
    title: "Sample Message — Edit in Studio",
    slug: "sample-message-2",
    date: "2026-05-31T16:00:00.000Z",
    speaker: pastorLJ,
    series: sampleSeries,
    scriptureRefs: ["Scripture reference"],
    description: "Another sample entry. Replace with a real sermon in the CMS.",
    thumbnail: { alt: "Sermon thumbnail placeholder", placeholder: true },
    sample: true,
  },
];

// Recurring weekly gatherings are facts; sample one-off events are flagged.
export const events: ChurchEvent[] = [
  {
    _id: "evt-prayer",
    title: "Saturday Morning Prayer",
    slug: "saturday-morning-prayer",
    start: "2026-06-13T15:00:00.000Z",
    recurrence: "Every Saturday",
    location: "1431 17th Avenue, Oakland, CA",
    description: "Start the weekend in prayer with the KBCF family.",
    source: "cms",
  },
  {
    _id: "evt-sunday",
    title: "Sunday Worship",
    slug: "sunday-worship",
    start: "2026-06-14T16:00:00.000Z",
    recurrence: "Every Sunday · 9:00 AM",
    location: "1431 17th Avenue, Oakland, CA",
    description: "Our weekly worship gathering. Come as you are — there's a seat for you.",
    source: "cms",
  },
  {
    _id: "evt-wed",
    title: "Wednesday Bible Study",
    slug: "wednesday-bible-study",
    start: "2026-06-17T19:00:00.000Z",
    recurrence: "Every Wednesday · 7:00 PM",
    location: "1431 17th Avenue, Oakland, CA",
    description: "Go deeper in the Word midweek.",
    source: "cms",
  },
  {
    _id: "evt-sample",
    title: "Sample Event — Edit in Studio",
    slug: "sample-event",
    start: "2026-07-04T17:00:00.000Z",
    location: "1431 17th Avenue, Oakland, CA",
    description: "This is a sample event to show the events layout. Add real events in the CMS or Planning Center.",
    registrationUrl: undefined,
    image: { alt: "Event image placeholder", placeholder: true },
    source: "cms",
    sample: true,
  },
];

export const groups: Group[] = [
  { _id: "grp-1", name: "Sample Group — Edit in Studio", slug: "sample-group", type: "Life Group", schedule: "Weekly", location: "Oakland", description: "Sample group to demonstrate the find-a-group layout. Add real groups in the CMS.", sample: true, image: { alt: "Group placeholder", placeholder: true } },
];

export const blogPosts: BlogPost[] = [
  {
    _id: "post-1",
    title: "Sample Post — Edit in Studio",
    slug: "sample-post",
    date: "2026-06-01T12:00:00.000Z",
    excerpt: "This sample article demonstrates the blog layout. Replace with real posts in the CMS.",
    author: { name: "KBCF" },
    category: "Updates",
    coverImage: { alt: "Blog cover placeholder", placeholder: true },
    bodyText: "This is placeholder body content for the blog. Add real articles in the CMS.",
    sample: true,
  },
];

// Intentionally empty: the old site's problem was stale, invented testimonials.
// Real, dated testimonials should be added in the CMS.
export const testimonials: Testimonial[] = [];

export const dreamCenter = {
  // "Dream Center" is KBCF's community outreach arm (verified). Program
  // specifics are placeholders pending approved copy.
  mission:
    "The Dream Center is the community outreach arm of Kingdom Builders Christian Fellowship, serving Oakland with the love of Jesus.",
  programsPlaceholder: true,
};
