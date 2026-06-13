import { defineField, defineType } from "sanity";
import { UserIcon, UsersIcon } from "@sanity/icons";

export const speaker = defineType({
  name: "speaker",
  title: "Speaker",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "role", type: "string" }),
    defineField({ name: "image", type: "accessibleImage" }),
  ],
  preview: { select: { title: "name", subtitle: "role", media: "image" } },
});

export const leader = defineType({
  name: "leader",
  title: "Leader",
  type: "document",
  icon: UsersIcon,
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "role", type: "string", validation: (r) => r.required() }),
    defineField({ name: "bio", type: "text", rows: 5, description: "Approved bio copy." }),
    defineField({ name: "image", type: "accessibleImage" }),
    defineField({ name: "order", type: "number", description: "Display order (lower = first)." }),
  ],
  orderings: [{ name: "order", title: "Display order", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "name", subtitle: "role", media: "image" } },
});
