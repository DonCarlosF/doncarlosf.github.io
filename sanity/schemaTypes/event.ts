import { defineField, defineType } from "sanity";
import { CalendarIcon } from "@sanity/icons";

export const event = defineType({
  name: "event",
  title: "Event",
  type: "document",
  icon: CalendarIcon,
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "start", title: "Start", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "end", title: "End", type: "datetime" }),
    defineField({ name: "allDay", title: "All day", type: "boolean", initialValue: false }),
    defineField({ name: "recurrence", title: "Recurrence (display text)", type: "string", description: 'e.g. "Every Sunday · 9:00 AM"' }),
    defineField({ name: "location", type: "string" }),
    defineField({ name: "description", type: "text", rows: 4 }),
    defineField({ name: "registrationUrl", title: "Registration URL", type: "url" }),
    defineField({ name: "image", type: "accessibleImage" }),
  ],
  orderings: [{ name: "start", title: "Soonest", by: [{ field: "start", direction: "asc" }] }],
  preview: { select: { title: "title", subtitle: "start", media: "image" } },
});
