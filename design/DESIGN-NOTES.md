# KBCF — Art Direction Proposals

**Five** distinct directions ship as live, swappable themes (the floating
switcher, bottom-right, flips between them on the deployed site). They share the
same information architecture, content model, and accessibility/performance
targets — they differ only in art direction (type, color, motion). Pick one and
we lock it in (and hide the switcher via `NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`).

The five sit on a deliberate **spectrum** from warm/calm to bold/kinetic:

| Theme | Position | Mood | Light/Dark | Color signature | Display type |
| --- | --- | --- | --- | --- | --- |
| Sanctuary | 0.0 | Reverent, editorial | Light | Garnet + gold on ivory | Fraunces (serif) |
| Grove | 0.25 | Fresh, organic, welcoming | Light | Forest green + clay on sage | Outfit |
| Sterling | 0.5 | Crisp, modern, architectural | Light | Ink + electric indigo on cool white | Bricolage Grotesque |
| Ember | 0.75 | Warm, intimate, candlelit | Dark | Amber + ember-orange on espresso | Newsreader (serif) |
| Movement | 1.0 | Bold, kinetic, clip-forward | Dark | Indigo + coral on near-black | Space Grotesk |

Implementation: each is a `[data-theme]` token set in `app/globals.css`; components
reference semantic tokens only, so the whole site restyles with one attribute flip.

> All imagery is a **clearly-labeled placeholder**. No invented photos,
> testimonials, names, or stats. Real KBCF photography drops in later.

The original two directions also exist as static `.html` mockups in this folder
(`direction-a-sanctuary.html`, `direction-b-movement.html`); the live themes are
the source of truth.

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

## Direction C — "Grove"  (fresh, organic, welcoming)

Light and airy with a living, nature-rooted palette. Reads as approachable and
community-first — growth, family, belonging.

- **Type:** Outfit (rounded geometric sans) / Inter (body)
- **Color:** Forest green `#2F6B4F` · Clay `#D98A4E` · Terracotta CTA `#C2632F`
  on sage paper `#F4F7F0`; forest ink `#1B2A20`.
- **Treatment:** generous 20px radii, pill buttons, organic underline on the hero
  accent, soft hover lifts.
- **Best when:** the priority is warmth + approachability with a contemporary,
  un-stuffy feel.

## Direction D — "Sterling"  (crisp, modern, architectural)

Design-forward and confident. High-contrast monochrome structure with one
electric accent — premium and minimal, like a studio brand.

- **Type:** Bricolage Grotesque (display) / Inter (body)
- **Color:** Ink `#15171C` (structure) + electric indigo `#3D5AFE` (actions) on
  cool white `#F4F5F7`.
- **Treatment:** tight 6–8px radii, ink top-bar and banners, editorial highlight
  marker on the hero accent, snappy transitions.
- **Best when:** the priority is a sharp, modern, "big-church-with-great-design"
  impression.

## Direction E — "Ember"  (warm, intimate, candlelit)

A *warm* dark theme — the bridge between Sanctuary's soul and Movement's
darkness. Espresso and golden light; reverent and cinematic at night.

- **Type:** Newsreader (display serif, italics) / Inter (body)
- **Color:** Amber `#D98A3D` + ember-orange `#D4622A` on espresso `#1A1410`;
  warm ivory text `#F3EBDF`.
- **Treatment:** glowing italic hero accent, warm radial hero, cards light their
  border on hover.
- **Best when:** the priority is warmth + premium feel, but with the drama and
  focus of a dark UI.

---

Both meet the same non-functional bar: WCAG 2.1 AA, mobile-first (tested 360px+),
Lighthouse 90+ target, semantic HTML, zoom never disabled.
