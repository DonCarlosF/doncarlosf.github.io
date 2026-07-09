import { NextResponse, type NextRequest } from "next/server";

/** Old WordPress `?page_id=N` URLs → new routes (ids fetched from the live
 *  site's wp-json API). Unknown ids fall back to the homepage. */
const PAGE_ID_MAP: Record<string, string> = {
  "1657": "/watch",        // livestream
  "1352": "/dream-center",
  "1284": "/groups",
  "1290": "/new-here",
  "1030": "/about",
  "255": "/give",          // giving
  "99": "/blog",
  "25": "/contact",
  "23": "/new-here",       // get-connected
  "19": "/events",
  "365": "/",              // home
};

export function middleware(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("page_id");
  if (pageId) {
    const dest = PAGE_ID_MAP[pageId] ?? "/";
    return NextResponse.redirect(new URL(dest, req.url), 301);
  }
  return NextResponse.next();
}

// WordPress page_id links always pointed at the site root ("/?page_id=N").
export const config = { matcher: "/" };
