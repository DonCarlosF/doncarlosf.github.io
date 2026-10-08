import { test, expect, type Page } from "@playwright/test";
import { HTML_ROUTES, SITEMAP_PATHS, THIRD_PARTY_HOSTS, SITEMAP_EXCLUDED } from "./routes";

function isThirdParty(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return THIRD_PARTY_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Collects console errors / uncaught exceptions and failed same-origin requests. */
function watchPage(page: Page, origin: string) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const src = msg.location().url;
    // Resource-load errors are attributed to the resource URL; skip third-party ones.
    if (src && isThirdParty(src)) return;
    if (THIRD_PARTY_HOSTS.some((h) => msg.text().includes(h))) return;
    consoleErrors.push(`${msg.text()}${src ? ` (${src})` : ""}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`Uncaught: ${err.message}`));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!url.startsWith(origin)) return;
    failedRequests.push(`${req.method()} ${url} — ${req.failure()?.errorText ?? "failed"}`);
  });

  return { consoleErrors, failedRequests };
}

test.describe("HTML routes", () => {
  for (const route of HTML_ROUTES) {
    test(`${route} renders cleanly`, async ({ page, baseURL }) => {
      const { consoleErrors, failedRequests } = watchPage(page, baseURL!);

      const response = await page.goto(route);
      expect(response, "navigation should produce a response").not.toBeNull();
      expect(response!.status()).toBe(200);

      // Let hydration and any late resource loads settle (bounded, never blocks on third parties).
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      await expect(page.locator("h1")).toHaveCount(1);
      expect((await page.title()).trim()).not.toBe("");
      expect(consoleErrors, "page console errors").toEqual([]);
      expect(failedRequests, "failed same-origin requests").toEqual([]);
    });
  }
});

test.describe("/studio", () => {
  // Sanity Studio is a heavy client-only app that needs project env to fully boot.
  // Only the server response is asserted here: it must serve, and must not 5xx.
  test("returns 200 and no server error", async ({ page }) => {
    const response = await page.goto("/studio");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    expect(response!.status()).toBeLessThan(500);
  });
});

test.describe("not found", () => {
  test("/nonexistent-page returns 404 with the custom page", async ({ page }) => {
    const response = await page.goto("/nonexistent-page");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(404);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText(/couldn.t find/i);
  });
});

test.describe("metadata routes", () => {
  test("/sitemap.xml lists the main routes", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("<urlset");
    for (const p of SITEMAP_PATHS) {
      expect(xml, `sitemap should list ${p || "/"}`).toMatch(new RegExp(`<loc>https?://[^<]+${escapeRegExp(p)}</loc>`));
    }
    for (const p of SITEMAP_EXCLUDED) {
      expect(xml, `sitemap must not list ${p}`).not.toMatch(new RegExp(`<loc>https?://[^<]+${escapeRegExp(p)}</loc>`));
    }
  });

  test("/robots.txt allows crawling and points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body).toMatch(/User-Agent:\s*\*/i);
    expect(body).toMatch(/Allow:\s*\//);
    expect(body).toMatch(/Disallow:\s*\/studio/);
    expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/);
  });

  test("/opengraph-image serves a PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
