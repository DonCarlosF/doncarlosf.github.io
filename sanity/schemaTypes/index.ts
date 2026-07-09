import type { SchemaTypeDefinition } from "sanity";
import { accessibleImage, serviceTime, socialLink } from "./objects";
import { siteSettings } from "./siteSettings";
import { homePage } from "./homePage";
import { aboutPage } from "./aboutPage";
import { speaker, leader } from "./people";
import { sermon, clip, series } from "./sermon";
import { event } from "./event";
import { group } from "./group";
import { outreachProgram } from "./outreachProgram";
import { blogPost } from "./blogPost";
import { testimonial, page } from "./misc";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    // objects
    accessibleImage, serviceTime, socialLink,
    // documents
    siteSettings, homePage, aboutPage,
    sermon, clip, series, speaker,
    event, group, leader, outreachProgram,
    blogPost, testimonial, page,
  ],
};
