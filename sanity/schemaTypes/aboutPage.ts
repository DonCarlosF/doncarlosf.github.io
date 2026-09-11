import { defineField, defineType } from "sanity";
import { InfoOutlineIcon } from "@sanity/icons";

/** About page content (singleton): intro, mission, story, the Five Pillars of
 *  Christianity (beliefs), and the core values. */
export const aboutPage = defineType({
  name: "aboutPage",
  title: "About Page",
  type: "document",
  icon: InfoOutlineIcon,
  fields: [
    defineField({ name: "intro", title: "Intro (A Church Like No Other)", type: "text", rows: 5 }),
    defineField({ name: "mission", title: "Our Mission", type: "text", rows: 3 }),
    defineField({ name: "storyHeading", title: "Story heading", type: "string", initialValue: "Our Story" }),
    defineField({ name: "story", title: "Our Story", type: "text", rows: 6, description: "Leave blank to show a 'coming soon' placeholder." }),
    defineField({
      name: "beliefs",
      title: "Our Beliefs — Five Pillars of Christianity",
      type: "array",
      of: [
        {
          type: "object",
          name: "belief",
          fields: [
            defineField({ name: "name", type: "string", validation: (r) => r.required() }),
            defineField({ name: "body", type: "text", rows: 4, validation: (r) => r.required() }),
          ],
          preview: { select: { title: "name", subtitle: "body" } },
        },
      ],
    }),
    defineField({
      name: "coreValues",
      title: "Core Values",
      type: "array",
      of: [
        {
          type: "object",
          name: "coreValue",
          fields: [
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "body", type: "text", rows: 4, validation: (r) => r.required() }),
          ],
          preview: { select: { title: "title", subtitle: "body" } },
        },
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "About Page" }) },
});
