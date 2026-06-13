import type { SchemaTypeDefinition } from "sanity";
import { accessibleImage, serviceTime, socialLink } from "./objects";
import { siteSettings } from "./siteSettings";
import { speaker, leader } from "./people";
import { sermon, clip, series } from "./sermon";
import { event } from "./event";
import { group } from "./group";
import { blogPost } from "./blogPost";
import { testimonial, page } from "./misc";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    // objects
    accessibleImage, serviceTime, socialLink,
    // documents
    siteSettings,
    sermon, clip, series, speaker,
    event, group, leader,
    blogPost, testimonial, page,
  ],
};
