import { createClient, type SanityClient } from "next-sanity";
import imageUrlBuilder from "@sanity/image-url";
import { apiVersion, dataset, projectId, isSanityConfigured } from "@/sanity/env";

/**
 * Sanity client — only instantiated when a project is configured. When it isn't,
 * the content API (lib/content/index.ts) falls back to local seed data so the
 * preview deploy renders without any external service.
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

const builder = sanityClient ? imageUrlBuilder(sanityClient) : null;

/** Resolve a Sanity image source to a URL; no-op when Sanity isn't configured. */
export function urlFor(source: unknown): string | undefined {
  if (!builder || !source) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return builder.image(source as any).auto("format").fit("max").url();
  } catch {
    return undefined;
  }
}

export { isSanityConfigured };
