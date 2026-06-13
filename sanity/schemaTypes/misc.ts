import { defineField, defineType } from "sanity";
import { CommentIcon, DocumentIcon } from "@sanity/icons";

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

/** Editable generic page (incl. homepage blocks). Block schema kept simple and
 *  extensible; add block objects here as the design system grows. */
export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  icon: DocumentIcon,
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({
      name: "blocks", title: "Content blocks", type: "array",
      of: [
        {
          type: "object", name: "richText", title: "Rich text",
          fields: [{ name: "content", type: "array", of: [{ type: "block" }] }],
        },
        {
          type: "object", name: "callout", title: "Callout",
          fields: [
            { name: "heading", type: "string" },
            { name: "body", type: "text" },
            { name: "ctalabel", title: "CTA label", type: "string" },
            { name: "ctaUrl", title: "CTA URL", type: "url" },
          ],
        },
      ],
    }),
  ],
});
