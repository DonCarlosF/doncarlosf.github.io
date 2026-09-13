import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";
import { HTML_ROUTES } from "./routes";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

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

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations, describeViolations(results.violations)).toEqual([]);
    });
  }
});
