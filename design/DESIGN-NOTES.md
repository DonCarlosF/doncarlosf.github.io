# KBCF — Art Direction Proposals

Two distinct directions for review. Both share the same information architecture,
content model, and accessibility/performance targets — they differ only in art
direction (type, color, motion, imagery). Pick one and we build the design system
from it.

> All imagery in the mockups is a **clearly-labeled placeholder**. No invented
> photos, testimonials, names, or stats. Real KBCF photography drops in later.

Render the mockups locally by opening the `.html` files in a browser, or
regenerate the PNGs with `/tmp/shot/shoot.mjs` (puppeteer).

---

## Direction A — "Sanctuary"  (warm, editorial, soulful)

Golden-hour worship feel. Gospel heritage meets modern editorial. Confident and
inviting; reads like the pulpit, not a brochure.

- **Type:** Fraunces (display serif, optical sizing + italics) / Inter (body)
- **Color system (one confident family):**
  - Warm ink `#211A14` · Ivory `#FBF6EE` / `#F3E9DA`
  - Primary Garnet `#7A1E2B` (deep `#5E121D`)
  - Accent Amber/Gold `#E0A53A`
  - Support Evergreen `#2E3A2F` · Muted `#6F6256`
- **Motion:** slow & cinematic — gentle fade-up reveals, soft hover lifts,
  subtle film-grain over hero. ~400–600ms easing.
- **Best when:** the priority is warmth, trust, and a timeless, premium feel.

## Direction B — "Movement"  (bold, kinetic, clip-forward)

High-energy, Oakland-modern, video- and clip-first. Big confident type, dark UI,
electric accents. Built around the sermon/clip operation.

- **Type:** Space Grotesk (display) / Inter (body)  — (production upgrade option:
  Clash Display for headlines)
- **Color system:**
  - Near-black `#0B0B0F` · Surfaces `#15151D` / `#1E1E28` · Lines `#2A2A36`
  - Text `#F4F3F0` · Muted `#9C9BAA`
  - Primary Indigo `#5B4DFF` (soft `#7C71FF`)
  - CTA Coral `#FF5436`
- **Motion:** snappy & kinetic — service-times ticker, scroll-snap vertical clip
  rail, autoplay muted hero video, ~180–300ms transitions, hover scale.
- **Best when:** the priority is reaching a younger audience and making sermon
  clips the centerpiece of the site.

---

Both meet the same non-functional bar: WCAG 2.1 AA, mobile-first (tested 360px+),
Lighthouse 90+ target, semantic HTML, zoom never disabled.
