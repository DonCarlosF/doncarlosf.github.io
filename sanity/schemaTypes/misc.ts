import { defineField, defineType } from "sanity";
import { CommentIcon } from "@sanity/icons";

export const testimonial = defineType({
  name: "testimonial",
  title: "Testimonial",
  type: "document",
  icon: CommentIcon,
  fields: [
    defineField({ name: "quote", type: "text", rows: 3, validation: (r) => r.required() }),
    defineField({ name: "attribution", type: "string", validation: (r) => r.required() }),
    defineField({ name: "image", type: "accessibleImage" }),
  ],
  preview: { select: { title: "attribution", subtitle: "quote", media: "image" } },
});
