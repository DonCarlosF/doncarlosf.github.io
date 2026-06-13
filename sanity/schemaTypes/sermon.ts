import { defineField, defineType } from "sanity";
import { PlayIcon, DocumentVideoIcon, BlockContentIcon } from "@sanity/icons";

export const series = defineType({
  name: "series",
  title: "Series",
  type: "document",
  icon: BlockContentIcon,
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "description", type: "text", rows: 3 }),
    defineField({ name: "image", type: "accessibleImage" }),
  ],
  preview: { select: { title: "title", media: "image" } },
});

export const clip = defineType({
  name: "clip",
  title: "Clip",
  type: "document",
  icon: PlayIcon,
  description: "Vertical short-form clip, typically produced from a sermon.",
  fields: [
    defineField({ name: "hook", title: "Hook text", type: "string", validation: (r) => r.required() }),
    defineField({ name: "caption", type: "text", rows: 2 }),
    defineField({ name: "videoUrl", title: "Vertical video URL", type: "url" }),
    defineField({ name: "thumbnail", type: "accessibleImage" }),
    defineField({ name: "parentSermon", title: "Parent sermon", type: "reference", to: [{ type: "sermon" }] }),
    defineField({
      name: "platform", type: "string",
      options: { list: ["instagram", "tiktok", "youtube", "facebook"] },
    }),
    defineField({ name: "hashtags", type: "array", of: [{ type: "string" }], options: { layout: "tags" } }),
    defineField({ name: "viralityScore", title: "Virality score", type: "number", validation: (r) => r.min(0).max(100) }),
  ],
  preview: { select: { title: "hook", subtitle: "platform", media: "thumbnail" } },
});

export const sermon = defineType({
  name: "sermon",
  title: "Sermon",
  type: "document",
  icon: DocumentVideoIcon,
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "date", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "speaker", type: "reference", to: [{ type: "speaker" }] }),
    defineField({ name: "series", type: "reference", to: [{ type: "series" }] }),
    defineField({ name: "scriptureRefs", title: "Scripture references", type: "array", of: [{ type: "string" }], options: { layout: "tags" } }),
    defineField({ name: "videoUrl", title: "Video URL (YouTube/Facebook)", type: "url" }),
    defineField({ name: "boxcastId", title: "BoxCast broadcast ID (optional)", type: "string" }),
    defineField({ name: "description", type: "text", rows: 4 }),
    defineField({ name: "thumbnail", type: "accessibleImage" }),
    defineField({ name: "clips", title: "Vertical clips", type: "array", of: [{ type: "reference", to: [{ type: "clip" }] }] }),
  ],
  orderings: [{ name: "date", title: "Newest", by: [{ field: "date", direction: "desc" }] }],
  preview: { select: { title: "title", subtitle: "date", media: "thumbnail" } },
});
