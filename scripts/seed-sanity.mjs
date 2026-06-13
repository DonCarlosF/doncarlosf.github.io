/**
 * Seed a Sanity dataset with KBCF's known facts (site settings + leadership).
 * Idempotent: uses fixed _ids + createOrReplace, so re-running is safe.
 *
 * Usage:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID=xxx NEXT_PUBLIC_SANITY_DATASET=production \
 *   SANITY_WRITE_TOKEN=sk... node scripts/seed-sanity.mjs
 *
 * Create a write token at: sanity.io → project → API → Tokens (Editor).
 * Only verified facts are seeded; bios/doctrine/photos remain for staff to add.
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
    serviceTimes: [
      { _type: "serviceTime", _key: "sat", day: "Saturday", label: "Morning Prayer", time: "Morning" },
      { _type: "serviceTime", _key: "sun", day: "Sunday", label: "Worship", time: "9:00 AM" },
      { _type: "serviceTime", _key: "wed", day: "Wednesday", label: "Bible Study", time: "7:00 PM" },
    ],
    address: { street: "1431 17th Avenue", city: "Oakland", state: "CA", zip: "94606" },
    mapEmbedQuery: "1431 17th Avenue, Oakland, CA 94606",
    boxcastId: "wsiikymmlhksnkgmc24r",
    givingProvider: "Clover",
    givingUrl: "https://www.clover.com/pay-widgets/fab217bf-1afb-4bda-9d0d-085098cbadac",
  },
  {
    _id: "speaker.lj",
    _type: "speaker",
    name: "Pastor L.J. Jennings",
    role: "Founder & Senior Pastor",
  },
  {
    _id: "leader.lj",
    _type: "leader",
    name: "Pastor L.J. Jennings",
    role: "Founder & Senior Pastor",
    bio: "L.J. Jennings is the Founder and Senior Pastor of Kingdom Builders Christian Fellowship, which he and Karen Jennings founded in 2009 after more than 20 years of ministry in the Bay Area. [Placeholder — add approved full bio.]",
    order: 1,
  },
  {
    _id: "leader.karen",
    _type: "leader",
    name: "Karen Jennings",
    role: "Co-Founder",
    bio: "Karen Jennings co-founded Kingdom Builders Christian Fellowship alongside Pastor L.J. Jennings in 2009. [Placeholder — add approved full bio.]",
    order: 2,
  },
];

const tx = docs.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
const res = await tx.commit();
console.log(`Seeded ${res.results.length} documents into ${projectId}/${dataset}.`);
