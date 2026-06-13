/**
 * GROQ queries. Projections return the exact shape lib/content/types.ts expects
 * (e.g. images projected to { src, alt }) so the UI is source-agnostic.
 */

const imgProj = `{ "src": asset->url, "alt": coalesce(alt, "") }`;

export const siteSettingsQuery = `*[_type == "siteSettings"][0]{
  churchName, tagline, mission, address, phone, email,
  serviceTimes[]{ day, label, time },
  boxcastId, givingProvider, givingUrl,
  social[]{ platform, url },
  "mapEmbedQuery": coalesce(mapEmbedQuery, address.street + ", " + address.city + ", " + address.state + " " + address.zip)
}`;

const clipProj = `{
  "_id": _id, hook, caption, "videoUrl": videoUrl, platform, hashtags, viralityScore,
  "thumbnail": thumbnail${imgProj}
}`;

const sermonProj = `{
  "_id": _id, title, "slug": slug.current, date,
  "speaker": speaker->{ "_id": _id, name, role, "image": image${imgProj} },
  "series": series->{ "_id": _id, title, "slug": slug.current, description },
  scriptureRefs, "videoUrl": videoUrl, boxcastId, description,
  "thumbnail": thumbnail${imgProj},
  "clips": clips[]->${clipProj}
}`;

export const sermonsQuery = `*[_type == "sermon"] | order(date desc) ${sermonProj}`;
export const latestSermonQuery = `*[_type == "sermon"] | order(date desc)[0] ${sermonProj}`;
export const sermonBySlugQuery = `*[_type == "sermon" && slug.current == $slug][0] ${sermonProj}`;

export const clipsQuery = `*[_type == "clip"] | order(viralityScore desc) ${clipProj}`;

const eventProj = `{
  "_id": _id, title, "slug": slug.current, start, end, allDay, recurrence,
  location, description, registrationUrl, "image": image${imgProj}, "source": "cms"
}`;

export const eventsQuery = `*[_type == "event"] | order(start asc) ${eventProj}`;
export const eventBySlugQuery = `*[_type == "event" && slug.current == $slug][0] ${eventProj}`;
export const upcomingEventsQuery = `*[_type == "event" && start >= now()] | order(start asc)[0...6] ${eventProj}`;

export const groupsQuery = `*[_type == "group"]{
  "_id": _id, name, "slug": slug.current, type, schedule, location, description, joinUrl, "image": image${imgProj}
}`;

export const leadersQuery = `*[_type == "leader"] | order(order asc){
  "_id": _id, name, role, bio, order, "image": image${imgProj}
}`;

const postProj = `{
  "_id": _id, title, "slug": slug.current, date, excerpt, category,
  "author": author->{ name, "image": image${imgProj} },
  "coverImage": coverImage${imgProj}, body
}`;

export const blogPostsQuery = `*[_type == "blogPost"] | order(date desc) ${postProj}`;
export const blogPostBySlugQuery = `*[_type == "blogPost" && slug.current == $slug][0] ${postProj}`;

export const testimonialsQuery = `*[_type == "testimonial"]{
  "_id": _id, quote, attribution, "image": image${imgProj}
}`;
