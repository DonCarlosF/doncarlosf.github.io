import { defineField, defineType } from "sanity";
import { HeartIcon } from "@sanity/icons";

/** Dream Center outreach program with its real, owner-supplied impact stat. */
export const outreachProgram = defineType({
  name: "outreachProgram",
  title: "Outreach Program",
  type: "document",
  icon: HeartIcon,
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "description", type: "text", rows: 3 }),
    defineField({ name: "stat", title: "Headline stat", type: "string", description: 'e.g. "500+"' }),
    defineField({ name: "statLabel", title: "Stat label", type: "string", description: 'e.g. "households served weekly"' }),
    defineField({ name: "schedule", type: "string", description: 'e.g. "Thursdays 11 AM"' }),
    defineField({ name: "serveCta", title: "Serve CTA label", type: "string", initialValue: "Volunteer" }),
    defineField({ name: "image", type: "accessibleImage" }),
    defineField({ name: "order", type: "number", description: "Display order (lower = first)." }),
  ],
  orderings: [{ name: "order", title: "Display order", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "name", subtitle: "stat", media: "image" } },
});
