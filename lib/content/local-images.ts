import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Img } from "./types";

/**
 * Zero-setup real photos: if a file named `public/images/<name>.<ext>` exists,
 * it replaces the labeled placeholder — no code or CMS change needed. Editors
 * can upload via the GitHub web UI ("Add file → Upload files"); Vercel rebuilds
 * and the photo appears. CMS (Sanity) images always take precedence because
 * callers only fall back here when no CMS src is present.
 */
const EXTS = ["jpg", "jpeg", "png", "webp", "avif"];
const IMAGES_DIR = path.join(process.cwd(), "public", "images");
const cache = new Map<string, string | null>();

function findLocal(name: string): string | null {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  let found: string | null = null;
  for (const ext of EXTS) {
    if (fs.existsSync(path.join(IMAGES_DIR, `${name}.${ext}`))) {
      found = `/images/${name}.${ext}`;
      break;
    }
  }
  cache.set(name, found);
  return found;
}

/** Returns a real image if `public/images/<name>.*` exists, else the fallback. */
export function localOr(name: string, fallback: Img): Img {
  const src = findLocal(name);
  return src ? { src, alt: fallback.alt } : fallback;
}
