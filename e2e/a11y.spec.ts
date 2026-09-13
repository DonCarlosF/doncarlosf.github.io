import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";
import { HTML_ROUTES } from "./routes";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Embeds we don't control: BoxCast, YouTube and Google Maps.
 *
 * axe descends into iframes, so these vendors' own markup gets reported as if
 * it were ours (BoxCast's player, for instance, renders a <dd> with no <dl>).
 * We can't remediate someone else's embed, and whether it finishes loading
 * before the scan runs depends on the network — which made this suite flaky:
 * it passed locally and failed in CI on the same commit.
 *
 * The iframe *elements* are still covered: axe's frame-title rule is skipped
 * along with the excluded subtree, so the accessible-name assertion below
 * replaces it.
 */
const THIRD_PARTY_FRAMES = [
  'iframe[src*="boxcast"]',
  'iframe[src*="youtube-nocookie.com"]',
  'iframe[src*="google.com/maps"]',
];

/** Human-readable failure output: rule, impact, help URL and the offending nodes. */
function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 5)
        .map((n) => `    - ${n.target.join(" ")}\n      ${n.failureSummary?.split("\n").join("\n      ")}`)
        .join("\n");
      return `[${v.impact ?? "n/a"}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
}

test.describe("accessibility (axe, WCAG 2.1 A/AA)", () => {
  for (const route of HTML_ROUTES) {
    test(`${route} has no violations`, async ({ page }) => {
      await page.goto(route);
      // Reveal-on-scroll content starts transparent; wait for hydration/animations to settle
      // so color-contrast is evaluated on the final rendered state.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const builder = THIRD_PARTY_FRAMES.reduce(
        (b, selector) => b.exclude(selector),
        new AxeBuilder({ page }).withTags(WCAG_TAGS)
      );
      const results = await builder.analyze();

      expect(results.violations, describeViolations(results.violations)).toEqual([]);

      // Stands in for axe's frame-title rule on the excluded embeds: every
      // iframe must still carry a non-empty accessible name.
      const untitled = await page.locator("iframe:not([title]), iframe[title='']").all();
      const untitledSrcs = await Promise.all(untitled.map((f) => f.getAttribute("src")));
      expect(untitledSrcs, "every iframe needs a non-empty title").toEqual([]);
    });
  }
});
