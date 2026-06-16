import { defineField, defineType } from "sanity";

/** Reusable image with REQUIRED alt text (WCAG 2.1 AA). Use everywhere. */
export const accessibleImage = defineType({
  name: "accessibleImage",
  title: "Image",
  type: "image",
  options: { hotspot: true },
  fields: [
    defineField({
      name: "alt",
      title: "Alt text",
      type: "string",
      description: "Describe the image for screen readers and SEO. Required.",
      validation: (Rule) => Rule.required().min(3).warning("Add descriptive alt text."),
    }),
  ],
});

export const serviceTime = defineType({
  name: "serviceTime",
  title: "Service time",
  type: "object",
  fields: [
    defineField({ name: "day", type: "string", validation: (r) => r.required() }),
    defineField({ name: "label", type: "string", description: 'e.g. "Worship", "Bible Study"', validation: (r) => r.required() }),
    defineField({ name: "time", type: "string", description: 'e.g. "9:00 AM" — leave blank for services with no fixed time (e.g. Morning Prayer)' }),
  ],
  preview: { select: { title: "day", subtitle: "label" } },
});

export const socialLink = defineType({
  name: "socialLink",
  title: "Social link",
  type: "object",
  fields: [
    defineField({
      name: "platform",
      type: "string",
      options: { list: ["instagram", "facebook", "youtube", "tiktok", "x", "boxcast"] },
      validation: (r) => r.required(),
    }),
    defineField({ name: "url", type: "url", validation: (r) => r.required() }),
  ],
  preview: { select: { title: "platform", subtitle: "url" } },
});
