import { defineField, defineType } from "sanity";
import { ComposeIcon } from "@sanity/icons";

export const blogPost = defineType({
  name: "blogPost",
  title: "Blog Post",
  type: "document",
  icon: ComposeIcon,
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "date", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "excerpt", type: "text", rows: 3 }),
    defineField({ name: "category", type: "string" }),
    defineField({
      name: "author", type: "object",
      fields: [
        defineField({ name: "name", type: "string" }),
        defineField({ name: "image", type: "accessibleImage" }),
      ],
    }),
    defineField({ name: "coverImage", type: "accessibleImage" }),
    defineField({
      name: "body", type: "array",
      of: [
        { type: "block" },
        { type: "accessibleImage" },
      ],
    }),
  ],
  orderings: [{ name: "date", title: "Newest", by: [{ field: "date", direction: "desc" }] }],
  preview: { select: { title: "title", subtitle: "category", media: "coverImage" } },
});
