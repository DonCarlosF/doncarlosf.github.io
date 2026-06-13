import { defineField, defineType } from "sanity";
import { CogIcon } from "@sanity/icons";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  icon: CogIcon,
  groups: [
    { name: "general", title: "General", default: true },
    { name: "contact", title: "Contact & Location" },
    { name: "integrations", title: "Integrations" },
  ],
  fields: [
    defineField({ name: "churchName", title: "Church name", type: "string", group: "general", validation: (r) => r.required() }),
    defineField({ name: "tagline", type: "string", group: "general" }),
    defineField({ name: "mission", type: "text", rows: 2, group: "general" }),
    defineField({
      name: "serviceTimes", title: "Service times", type: "array",
      of: [{ type: "serviceTime" }], group: "general",
    }),
    defineField({
      name: "address", type: "object", group: "contact",
      fields: [
        defineField({ name: "street", type: "string" }),
        defineField({ name: "city", type: "string" }),
        defineField({ name: "state", type: "string" }),
        defineField({ name: "zip", type: "string" }),
      ],
    }),
    defineField({ name: "phone", type: "string", group: "contact" }),
    defineField({ name: "email", type: "string", group: "contact" }),
    defineField({ name: "mapEmbedQuery", title: "Map search query", type: "string", group: "contact" }),
    defineField({ name: "social", title: "Social links", type: "array", of: [{ type: "socialLink" }], group: "contact" }),
    defineField({ name: "boxcastId", title: "BoxCast channel ID", type: "string", group: "integrations" }),
    defineField({ name: "givingProvider", title: "Giving provider", type: "string", group: "integrations" }),
    defineField({ name: "givingUrl", title: "Giving URL (embed/deep link)", type: "url", group: "integrations" }),
    defineField({ name: "heroVideoUrl", title: "Hero background video URL (optional, muted loop)", type: "url", group: "integrations" }),
  ],
  preview: { prepare: () => ({ title: "Site Settings" }) },
});
