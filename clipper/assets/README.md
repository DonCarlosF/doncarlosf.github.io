# assets/

Drop branding assets here.

## `kbcf-logo.png` (expected, not committed)

The church logo is the Facebook profile photo
(facebook.com/kingdombuilderscf). **We do not fetch it at runtime** — Facebook
blocks automated/hot-link access and its image URLs expire. Save the PNG here
manually:

```
assets/kbcf-logo.png
```

- Recommended: transparent PNG, ~512px on the long edge.
- It is overlaid top-left, scaled to ~16% of the 1080px frame width.

**If this file is missing**, the pipeline does not fail: it falls back to a
transparent **"KBCF" text wordmark** and samples no logo colors (it uses the
default brand palette, or your `config.yaml` overrides). This is documented in
[`../DECISIONS.md`](../DECISIONS.md).

## Optional: caption font

Captions use `Montserrat-Bold` by default (configurable). For deterministic
rendering, install the font system-wide or place the `.ttf` where libass/
fontconfig can find it. Missing fonts fall back to a system sans.
