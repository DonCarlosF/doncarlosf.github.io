/**
 * Seed a Sanity dataset with KBCF's approved content (site settings, home page,
 * about page, leadership, testimonial).
 * Idempotent: uses fixed _ids + createOrReplace, so re-running is safe.
 *
 * Usage:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID=xxx NEXT_PUBLIC_SANITY_DATASET=production \
 *   SANITY_WRITE_TOKEN=sk... node scripts/seed-sanity.mjs
 *
 * Create a write token at: sanity.io → project → API → Tokens (Editor).
 * Photos are NOT seeded — upload them in the Studio (or public/images/).
 */
import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !token) {
  console.error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_WRITE_TOKEN.");
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: "2024-10-01", useCdn: false });

const docs = [
  {
    _id: "siteSettings",
    _type: "siteSettings",
    churchName: "Kingdom Builders Christian Fellowship",
    tagline: "Church Like No Other",
    mission: "People are our heart and Jesus is our message.",
    // TODO(owner): confirm service times (sourced from the church's old site).
    serviceTimes: [
      { _type: "serviceTime", _key: "prayerline", day: "Mon–Fri", label: "Prayer Line", time: "6:30–7:00 AM", phone: "(267) 930-4000", passcode: "089470707#" },
      { _type: "serviceTime", _key: "sat", day: "Saturday", label: "Morning Prayer", time: "9:00 AM" },
      { _type: "serviceTime", _key: "sun", day: "Sunday", label: "Worship", time: "9:00–10:45 AM" },
      { _type: "serviceTime", _key: "wedprayer", day: "Wednesday", label: "Corporate Prayer", time: "6:30 PM" },
      { _type: "serviceTime", _key: "wed", day: "Wednesday", label: "Bible Study", time: "7:00 PM" },
    ],
    phone: "(510) 326-2446",
    social: [{ _type: "socialLink", _key: "fb", platform: "facebook", url: "https://www.facebook.com/kingdombuilderscf" }],
    address: { street: "1431 17th Avenue", city: "Oakland", state: "CA", zip: "94606" },
    mapEmbedQuery: "1431 17th Avenue, Oakland, CA 94606",
    boxcastId: "wsiikymmlhksnkgmc24r",
    givingProvider: "Clover",
    givingUrl: "https://www.clover.com/pay-widgets/fab217bf-1afb-4bda-9d0d-085098cbadac",
  },
  {
    _id: "homePage",
    _type: "homePage",
    heroSlides: [
      { _type: "heroSlide", _key: "s1", eyebrow: "God says you are", accent: "Enough.", ctaLabel: "Plan your visit", ctaHref: "/new-here" },
      { _type: "heroSlide", _key: "s2", eyebrow: "There's a place for you", title: "You belong", accent: "here.", ctaLabel: "Get connected", ctaHref: "/new-here#connect" },
      { _type: "heroSlide", _key: "s3", eyebrow: "Livestream every weekend", title: "Watch", accent: "online.", ctaLabel: "Watch live", ctaHref: "/watch" },
    ],
    // No banner seeded — the site falls back to the soonest upcoming event.
    welcomeHeading: "Church Like No Other",
    welcomeBody:
      "Welcome to Kingdom Builders! Whatever your age or life story, you are welcome! Our mission is simple: People are our heart and Jesus is our message. Kingdom Builders is an Oakland, CA based 21st century ministry. We love people from where they are and disciple them to be all God has called them to be. Come experience the love of Christ for yourself. We’re glad you’re here!",
    pastorsHeading: "Meet Pastors LJ & Karen",
    pastorsBody:
      "Pastors LJ and Karen Jennings have dedicated their lives, voices, and resources to creating transformational experiences that help others dream again resulting in a deeper relationship with God, and collision with purpose. They have a heart to reach our city and beyond with the life transforming message of Jesus.",
  },
  {
    _id: "aboutPage",
    _type: "aboutPage",
    intro:
      "Kingdom Builders is a contemporary, non-denominational, 21st century ministry dedicated to reaching people where they are and sharing with them the love of Christ. Since our inception in 2009, Kingdom Builders progressively lives out its mission to lead people into a fully devoted relationship with Jesus Christ by loving people, cultivating community and inspiring hope.",
    mission:
      "Love people where they are and encourage them to grow in their relationship with Jesus Christ. Bringing people that are far from God close to him.",
    storyHeading: "Our Story",
    beliefs: [
      { _type: "belief", _key: "b1", name: "Jesus Christ", body: "We believe that Jesus was the Son of God, who was sacrificed so that humans could have eternal life in heaven. The key events in Jesus’ life that shape Christian beliefs include his crucifixion, resurrection and ascension." },
      { _type: "belief", _key: "b2", name: "The Trinity", body: "We believe there is one God who eternally exists as three Elements - Father, Son and Holy Spirit. The Holy Spirit is the Spirit of God who dwells and empowers all Christians to lead a godly life. They describe their faith in “One God, In three persons.” All three persons are equal and eternal." },
      { _type: "belief", _key: "b3", name: "The Bible", body: "We believe that the bible is the infallible word of God, which is sufficient for all we need to live a Christian life. It is a book of writings which is considered to be sacred by many Christians, and which includes the Hebrew Scriptures and a collection of writings from the early Christian Church. “All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness, so that the servant of God may be thoroughly equipped for every good work.” 2 Timothy 3:16-17" },
      { _type: "belief", _key: "b4", name: "Justification By Faith", body: "We believe that through our faith in Jesus, we can have a right relationship with God." },
      { _type: "belief", _key: "b5", name: "Prayer", body: "We believe that prayer is a way to communicate with God, and is one of five spiritual practices that are essential to growing our faith." },
    ],
    coreValues: [
      { _type: "coreValue", _key: "v1", title: "Service Is What We Do", body: "Jesus was the greatest servant and our greatest example of service. From the least to the greatest, we are all called to serve one another. It is a privilege and honor that we get to serve." },
      { _type: "coreValue", _key: "v2", title: "Connections Are What We Create", body: "Connecting with people of like passions and interests, creates relationships and propels the work of God. We encourage everyone to make connections with others though one of the many ministries committed to service." },
      { _type: "coreValue", _key: "v3", title: "Hope Is Our Message", body: "We share the hope and message of Jesus and not a denomination or doctrine. We are committed to reaching those in search for a relationship with God and understand that the message is sacred and not the methods of reaching them." },
      { _type: "coreValue", _key: "v4", title: "Gifts Are To Be Given", body: "We all have been given a gift to be used in the Kingdom of God. We give in three ways: we give out time, we give out talent and we give of our treasure. God has given richly towards us, it’s our honor to give back to Him." },
      { _type: "coreValue", _key: "v5", title: "People Are Our Focus", body: "God is the only judge, so Kingdom Builders is committed to loving and not judging. We all are sinners and are just grateful for our salvation." },
      { _type: "coreValue", _key: "v6", title: "Passion With A Purpose", body: "Everything we do, we do with passion and purpose. Passionate about Jesus and Purposeful about our worship. Our worship is passionate and Spirit energized. Our passion is for Jesus, His people and His Church." },
    ],
  },
  {
    _id: "speaker.lj",
    _type: "speaker",
    name: "Dr. LJ Jennings",
    role: "Founder & Senior Pastor",
  },
  {
    _id: "leader.lj",
    _type: "leader",
    name: "Dr. LJ Jennings",
    role: "Founder & Senior Pastor",
    bio: "Founder and Senior Pastor of Kingdom Builders Christian Fellowship. Having served more than 20 years in the Bay Area Ministry. In 2009 God called Pastor Jennings to establish and create a “Church Like No Other”. LJ holds a Doctorate in Theology from Sacramento Theological Seminary, an Honorary Doctorate in Ministry from Bell Grove Theological Seminary, A Masters and Bachelors in Christian Education from CH Mason Bible College. He also attended California State University Hayward, where he majored in Political Science and Business Administration. He is a graduate of the Dale Carnegie Courses.",
    order: 1,
  },
  {
    _id: "leader.karen",
    _type: "leader",
    name: "Dr. Karen Jennings",
    role: "Co-Pastor",
    bio: "Pastor LJ and Karen have a heart to reach our city and beyond with the life transforming message of Jesus. [Extended bio coming soon.]",
    order: 2,
  },
  {
    _id: "testimonial.brenda",
    _type: "testimonial",
    quote: "At KBCF I am making a difference in my community through my ministry work. I love serving and helping others at KBCF.",
    attribution: "Brenda H.",
  },
];

const tx = docs.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
const res = await tx.commit();
console.log(`Seeded ${res.results.length} documents into ${projectId}/${dataset}.`);
