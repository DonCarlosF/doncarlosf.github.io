import { createClient, type SanityClient } from "next-sanity";
import { apiVersion, dataset, projectId, isSanityConfigured } from "@/sanity/env";

/**
 * Sanity client — only instantiated when a project is configured. When it isn't,
 * the content API (lib/content/index.ts) falls back to local seed data so the
 * preview deploy renders without any external service.
 *
 * Image URLs are projected in GROQ (`asset->url`), so no URL builder is needed here.
 */
export const sanityClient: SanityClient | null = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: process.env.NODE_ENV === "production",
      perspective: "published",
    })
  : null;

export { isSanityConfigured };
