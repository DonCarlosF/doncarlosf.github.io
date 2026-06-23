import type { StructureResolver } from "sanity/structure";

/** Studio desk: Site Settings as a singleton, content grouped sensibly. */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Site Settings")
        .id("siteSettings")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
      S.listItem()
        .title("Home Page")
        .id("homePage")
        .child(S.document().schemaType("homePage").documentId("homePage")),
      S.listItem()
        .title("About Page")
        .id("aboutPage")
        .child(S.document().schemaType("aboutPage").documentId("aboutPage")),
      S.divider(),
      S.documentTypeListItem("sermon").title("Sermons"),
      S.documentTypeListItem("clip").title("Clips"),
      S.documentTypeListItem("series").title("Series"),
      S.documentTypeListItem("speaker").title("Speakers"),
      S.divider(),
      S.documentTypeListItem("event").title("Events"),
      S.documentTypeListItem("group").title("Groups"),
      S.documentTypeListItem("leader").title("Leaders"),
      S.divider(),
      S.documentTypeListItem("blogPost").title("Blog Posts"),
      S.documentTypeListItem("testimonial").title("Testimonials"),
      S.documentTypeListItem("page").title("Pages"),
    ]);
