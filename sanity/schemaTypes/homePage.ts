import { defineField, defineType } from "sanity";
import { HomeIcon } from "@sanity/icons";

/** Home page content (singleton). Editable hero slideshow, event banner,
 *  welcome intro, and pastors snippet. */
export const homePage = defineType({
  name: "homePage",
  title: "Home Page",
  type: "document",
  icon: HomeIcon,
  groups: [
    { name: "hero", title: "Hero slideshow", default: true },
    { name: "banner", title: "Event banner" },
    { name: "welcome", title: "Welcome & Pastors" },
  ],
  fields: [
    defineField({
      name: "heroSlides",
      title: "Hero slides",
      type: "array",
      group: "hero",
      of: [
        {
          type: "object",
          name: "heroSlide",
          fields: [
            defineField({ name: "eyebrow", title: "Kicker (small line above)", type: "string" }),
            defineField({ name: "title", title: "Headline", type: "string" }),
            defineField({ name: "accent", title: "Emphasized phrase", type: "string", description: "Rendered with the theme's hero accent treatment." }),
            defineField({ name: "ctaLabel", title: "Button label", type: "string" }),
            defineField({ name: "ctaHref", title: "Button link (path or URL)", type: "string" }),
          ],
          preview: { select: { title: "title", subtitle: "accent" } },
        },
      ],
    }),
    defineField({
      name: "eventBanner",
      title: "Event banner",
      type: "object",
      group: "banner",
      fields: [
        defineField({ name: "enabled", title: "Show banner", type: "boolean", initialValue: true }),
        defineField({ name: "title", type: "string", validation: (r) => r.required() }),
        defineField({ name: "date", type: "string", description: 'e.g. "May 8, 2024"' }),
        defineField({ name: "location", type: "string" }),
        defineField({ name: "ctaLabel", title: "Button label", type: "string" }),
        defineField({ name: "ctaHref", title: "Button link (path or URL)", type: "string" }),
      ],
    }),
    defineField({ name: "welcomeHeading", title: "Welcome heading", type: "string", group: "welcome" }),
    defineField({ name: "welcomeBody", title: "Welcome text", type: "text", rows: 6, group: "welcome" }),
    defineField({ name: "pastorsHeading", title: "Pastors heading", type: "string", group: "welcome" }),
    defineField({ name: "pastorsBody", title: "Pastors text", type: "text", rows: 5, group: "welcome" }),
    defineField({ name: "pastorsImage", title: "Pastors photo", type: "accessibleImage", group: "welcome" }),
  ],
  preview: { prepare: () => ({ title: "Home Page" }) },
});
