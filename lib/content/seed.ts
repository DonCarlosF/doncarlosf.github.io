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
  HomeContent, AboutContent,
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
    { day: "Mon–Fri", label: "Prayer Line", time: "6:30–7:00 AM", phone: "(267) 930-4000", passcode: "089470707#" },
    { day: "Saturday", label: "Morning Prayer" },
    { day: "Sunday", label: "Worship", time: "9:00 AM" },
    { day: "Wednesday", label: "Bible Study", time: "7:00 PM" },
  ],
  boxcastId: "wsiikymmlhksnkgmc24r",
  givingProvider: "Clover",
  givingUrl: "https://www.clover.com/pay-widgets/fab217bf-1afb-4bda-9d0d-085098cbadac",
  heroVideoUrl: undefined, // add an MP4/HLS hero loop in the CMS when available

  // Social handles not supplied — left empty rather than guessed.
  social: [],
  mapEmbedQuery: "1431 17th Avenue, Oakland, CA 94606",
};

const pastorLJ: Speaker = { _id: "spk-lj", name: "Dr. LJ Jennings", role: "Founder & Senior Pastor" };

export const leaders: Leader[] = [
  {
    _id: "ldr-lj",
    name: "Dr. LJ Jennings",
    role: "Founder & Senior Pastor",
    bio: "Founder and Senior Pastor of Kingdom Builders Christian Fellowship. Having served more than 20 years in the Bay Area Ministry. In 2009 God called Pastor Jennings to establish and create a “Church Like No Other”. LJ holds a Doctorate in Theology from Sacramento Theological Seminary, an Honorary Doctorate in Ministry from Bell Grove Theological Seminary, A Masters and Bachelors in Christian Education from CH Mason Bible College. He also attended California State University Hayward, where he majored in Political Science and Business Administration. He is a graduate of the Dale Carnegie Courses.",
    image: { alt: "Dr. LJ Jennings, Founder & Senior Pastor", placeholder: true },
    order: 1,
  },
  {
    _id: "ldr-karen",
    name: "Dr. Karen Jennings",
    role: "Co-Pastor",
    // Extended bio pending from the pastoral team.
    bio: "Pastor LJ and Karen have a heart to reach our city and beyond with the life transforming message of Jesus. [Extended bio coming soon.]",
    bioPlaceholder: true,
    image: { alt: "Dr. Karen Jennings, Co-Pastor", placeholder: true },
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

// Real testimonial provided by the pastoral team. Add more in the CMS.
export const testimonials: Testimonial[] = [
  {
    _id: "tst-brenda",
    quote:
      "At KBCF I am making a difference in my community through my ministry work. I love serving and helping others at KBCF.",
    attribution: "Brenda H.",
  },
];

export const dreamCenter = {
  // "Dream Center" is KBCF's community outreach arm (verified). Program
  // specifics are placeholders pending approved copy.
  mission:
    "The Dream Center is the community outreach arm of Kingdom Builders Christian Fellowship, serving Oakland with the love of Jesus.",
  programsPlaceholder: true,
  volunteerHeading: "Volunteer With Us!",
  volunteerBody:
    "With just a few hours of your time, you can immerse into a compassionate network that offers hope to individuals and Oakland communities. Not only will your time and service touch and change the lives of others, but will also impact you and yours.",
};

/** Home page content — editable in the CMS (homePage singleton). */
export const homePage: HomeContent = {
  heroSlides: [
    { eyebrow: "God says you are", accent: "Enough.", ctaLabel: "Plan your visit", ctaHref: "/new-here" },
    { eyebrow: "There's a place for you", title: "You belong", accent: "here.", ctaLabel: "Get connected", ctaHref: "/new-here#connect" },
    { eyebrow: "Livestream every weekend", title: "Watch", accent: "online.", ctaLabel: "Watch live", ctaHref: "/watch" },
  ],
  eventBanner: {
    enabled: true,
    title: "Corporate Prayer & Bible Study",
    date: "May 8, 2024",
    location: "1431 17th Avenue, Oakland, CA 94606",
    ctaLabel: "Get directions",
    ctaHref: "https://maps.google.com/?q=1431%2017th%20Avenue%2C%20Oakland%2C%20CA%2094606",
  },
  welcomeHeading: "Church Like No Other",
  welcomeBody:
    "Welcome to Kingdom Builders! Whatever your age or life story, you are welcome! Our mission is simple: People are our heart and Jesus is our message. Kingdom Builders is an Oakland, CA based 21st century ministry. We love people from where they are and disciple them to be all God has called them to be. Come experience the love of Christ for yourself. We’re glad you’re here!",
  pastorsHeading: "Meet Pastors LJ & Karen",
  pastorsBody:
    "Pastors LJ and Karen Jennings have dedicated their lives, voices, and resources to creating transformational experiences that help others dream again resulting in a deeper relationship with God, and collision with purpose. They have a heart to reach our city and beyond with the life transforming message of Jesus.",
  pastorsImage: { alt: "Pastors LJ & Karen Jennings", placeholder: true },
};

/** About page content — editable in the CMS (aboutPage singleton). */
export const aboutPage: AboutContent = {
  intro:
    "Kingdom Builders is a contemporary, non-denominational, 21st century ministry dedicated to reaching people where they are and sharing with them the love of Christ. Since our inception in 2009, Kingdom Builders progressively lives out its mission to lead people into a fully devoted relationship with Jesus Christ by loving people, cultivating community and inspiring hope.",
  mission:
    "Love people where they are and encourage them to grow in their relationship with Jesus Christ. Bringing people that are far from God close to him.",
  storyHeading: "Our Story",
  story: undefined, // pending approved copy from the pastoral team
  storyPlaceholder: true,
  beliefs: [
    { name: "Jesus Christ", body: "We believe that Jesus was the Son of God, who was sacrificed so that humans could have eternal life in heaven. The key events in Jesus’ life that shape Christian beliefs include his crucifixion, resurrection and ascension." },
    { name: "The Trinity", body: "We believe there is one God who eternally exists as three Elements - Father, Son and Holy Spirit. The Holy Spirit is the Spirit of God who dwells and empowers all Christians to lead a godly life. They describe their faith in “One God, In three persons.” All three persons are equal and eternal." },
    { name: "The Bible", body: "We believe that the bible is the infallible word of God, which is sufficient for all we need to live a Christian life. It is a book of writings which is considered to be sacred by many Christians, and which includes the Hebrew Scriptures and a collection of writings from the early Christian Church. “All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness, so that the servant of God may be thoroughly equipped for every good work.” 2 Timothy 3:16-17" },
    { name: "Justification By Faith", body: "We believe that through our faith in Jesus, we can have a right relationship with God." },
    { name: "Prayer", body: "We believe that prayer is a way to communicate with God, and is one of five spiritual practices that are essential to growing our faith." },
  ],
  coreValues: [
    { title: "Service Is What We Do", body: "Jesus was the greatest servant and our greatest example of service. From the least to the greatest, we are all called to serve one another. It is a privilege and honor that we get to serve." },
    { title: "Connections Are What We Create", body: "Connecting with people of like passions and interests, creates relationships and propels the work of God. We encourage everyone to make connections with others though one of the many ministries committed to service." },
    { title: "Hope Is Our Message", body: "We share the hope and message of Jesus and not a denomination or doctrine. We are committed to reaching those in search for a relationship with God and understand that the message is sacred and not the methods of reaching them." },
    { title: "Gifts Are To Be Given", body: "We all have been given a gift to be used in the Kingdom of God. We give in three ways: we give out time, we give out talent and we give of our treasure. God has given richly towards us, it’s our honor to give back to Him." },
    { title: "People Are Our Focus", body: "God is the only judge, so Kingdom Builders is committed to loving and not judging. We all are sinners and are just grateful for our salvation." },
    { title: "Passion With A Purpose", body: "Everything we do, we do with passion and purpose. Passionate about Jesus and Purposeful about our worship. Our worship is passionate and Spirit energized. Our passion is for Jesus, His people and His Church." },
  ],
};
