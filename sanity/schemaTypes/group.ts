import { defineField, defineType } from "sanity";
import { UsersIcon } from "@sanity/icons";

export const group = defineType({
  name: "group",
  title: "Group",
  type: "document",
  icon: UsersIcon,
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "name" }, validation: (r) => r.required() }),
    defineField({ name: "type", title: "Group type", type: "string", description: 'e.g. "Life Group", "Men", "Women", "Youth"' }),
    defineField({ name: "schedule", type: "string", description: 'e.g. "Tuesdays, 7:00 PM"' }),
    defineField({ name: "location", type: "string" }),
    defineField({ name: "description", type: "text", rows: 3 }),
    defineField({ name: "joinUrl", title: "Join / contact URL", type: "url" }),
    defineField({ name: "image", type: "accessibleImage" }),
  ],
  preview: { select: { title: "name", subtitle: "type", media: "image" } },
});
