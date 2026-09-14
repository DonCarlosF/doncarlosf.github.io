import { test, expect, type APIRequestContext } from "@playwright/test";

/** Follows nothing; returns the status and the redirect target (path + query). */
async function redirectOf(request: APIRequestContext, path: string, baseURL: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  const location = res.headers()["location"];
  const url = location ? new URL(location, baseURL) : undefined;
  return { status: res.status(), to: url ? url.pathname + url.search : undefined };
}

test.describe("legacy WordPress URL redirects", () => {
  test.describe("next.config.ts redirects (308)", () => {
    const cases: Array<[string, string]> = [
      ["/giving", "/give"],
      ["/livestream", "/watch"],
      ["/the-power-of-the-tongue", "/blog"],
    ];
    for (const [from, to] of cases) {
      test(`${from} → ${to}`, async ({ request, baseURL }) => {
        expect(await redirectOf(request, from, baseURL!)).toEqual({ status: 308, to });
      });
    }
  });

  test.describe("?page_id= redirects (query-matched in next.config.ts, no proxy)", () => {
    // Next passes the matched query through to the destination — harmless leftover.
    test("/?page_id=1657 → /watch (known id)", async ({ request, baseURL }) => {
      expect(await redirectOf(request, "/?page_id=1657", baseURL!)).toEqual({ status: 308, to: "/watch?page_id=1657" });
    });

    test("/?page_id=999999 renders the homepage (unknown id, no redirect loop)", async ({ request, baseURL }) => {
      expect(await redirectOf(request, "/?page_id=999999", baseURL!)).toEqual({ status: 200, to: undefined });
    });
  });
});
