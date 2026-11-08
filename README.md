# Rich media ads – SF-FE-01-BAM

Two animated ads built from the provided designs and assets with plain HTML, CSS, JavaScript and GSAP.
The original task is in [TASK.md](TASK.md), decisions are in [DECISIONS.md](DECISIONS.md), and my open questions about the assets are in [QUESTIONS.md](QUESTIONS.md).

| | Variant | Entry point |
|---|---|---|
| A | **Gut Run**: mobile tap-to-jump game ad (360×640) | `variant-a-game/index.html` |
| B | **Fireplace**: top 1032×250 + left/right 320×975 | `variant-b-fireplace/preview.html` (parts: `top.html`, `left.html`, `right.html`) |

## Run locally

From the repository root:

```bash
npx serve .
```

Then open:

- http://localhost:3000/variant-a-game/
- http://localhost:3000/variant-b-fireplace/preview.html

> Keep the trailing slash on `/variant-a-game/`. `serve` redirects `…/index.html` to `/variant-a-game` without a slash, and relative paths (`styles.css`, `assets/…`) then resolve from the wrong folder.
> Use an http server, not `file://`: sounds are loaded with `fetch()` and hitboxes read image pixels, and browsers block both on `file://`.

For the game, use mobile emulation in DevTools (Ctrl+Shift+M), e.g. iPhone SE (320×568 class) up to 430×932.

### Debug URLs

| URL | What it does |
|---|---|
| `variant-a-game/?debug=1` | draws hitboxes (pixel masks), the generated safe path and the state |
| `variant-a-game/?debug=1&auto=1` | a simple bot plays the run (checks that courses are winnable) |
| `variant-a-game/?debug=1&auto=1&turbo=8` | same, 8× fast-forward (physics and GSAP sped up together) |
| `variant-a-game/?overlay=start` / `fail` / `win` | design PNG at 50 % on top of the build |
| `variant-b-fireplace/preview.html?overlay=1` | `layout.png` at 50 % on top of all three parts |

## What's in it

**Gut Run**
- Start screen with intro animation; the first tap starts the run with a short "get ready" glide.
- Tap or Space to jump; gravity, a fixed player x, and the gut and obstacles scroll right to left. Each of the 15 obstacles appears exactly once per run, with a gentle speed ramp.
- Pixel-mask collision, so no deaths from transparent corners. Touching the cloud wall ends the run.
- Fail endcard with CTA and replay (clean restart); win endcard with confetti, cheer and applause.
- Background music, crash, fail and win sounds after the first interaction; mute toggle.
- Pauses game, animations and audio on `visibilitychange` and when less than 50 % of the ad is in view.
- `prefers-reduced-motion`: decorative loops off, entrances become fades.

**Fireplace**
- One continuous background (`bg-big.jpg`) across all three parts; the seams stay aligned while zooming.
- Intro (about 4 s), synced across the three documents via `postMessage`: background zoom, logo, text panel, copy, line-by-line top headline, CTA last.
- Calm idle afterwards (background breathing, CTA pulse) that stops after about 30 s.
- Clickout anywhere on a part. `prefers-reduced-motion` shows the final state.

## Weight

| | Shipped files | Size |
|---|---|---|
| A | HTML/CSS/JS + used assets (audio ≈ 1.4 MB of it) | ≈ 2.1 MB |
| B | HTML/CSS/JS + `bg-big.jpg` (2.0 MB) + layers | ≈ 2.2 MB |

GSAP 3.12.5 is loaded from cdnjs (not counted). The per-part `bg.jpg` files in variant B are not used.
TODO: compress `bg-big.jpg` (and note the tool and settings here).

## With more time

- Recompress `bg-big.jpg`, or ship per-part crops of it (with a margin for the zoom) so each separate ad downloads less.
- Ask for a separate product PNG so the product can slide in on its own (it is baked into the background).
- Test on real devices (especially iOS Safari: audio unlock, toolbar heights).
- Re-encode the audio (the applause file alone is 600 KB) and trim the music loop.
- Self-host GSAP for ad servers that don't allow CDNs.
- Add a few Playwright smoke tests: start → crash → replay, and the timing sync of the fireplace parts.

## Known issues / shortcuts

- Copy in some assets doesn't match the designs (see QUESTIONS.md); I used the assets as delivered.
- `box.png`, `cta.png` and the skyscraper `hl.png` files have no transparency. This is handled in CSS (clip-path, `mix-blend-mode: screen`, border-radius) instead of editing the assets.
- Variant B assumes a 4 px gap between the parts (1680 = 320 + 4 + 1032 + 4 + 320).
- Opened via `file://`, the game falls back to ellipse hitboxes and has no sound.
- Not tested on real phones, only in desktop browser emulation.

## How I used AI

<!-- TODO: put this in your own words -->
I used Claude Code to scaffold both variants, measure asset positions against the design files, and draft the docs. I reviewed, tested and adjusted the output myself. Places where it was wrong and had to be fixed:

- **Fireplace zoom broke the seams.** The first version gave each part only its own slice of the background and scaled it around the centre of the whole fireplace. That pulled the image away from the outer edge of the side parts. Fixed by giving every part the full 1680 px layer, shifted to its window.
- **Win screen never appeared.** Tweens were added to a GSAP timeline that had already finished, and GSAP drops finished timelines, so the win animation silently never ran. Fixed by starting a fresh timeline for each phase.
- **Render loop started too early.** The `IntersectionObserver` fires on page load and started the render loop before the hitbox masks were built, which crashed debug mode. Fixed by not starting the loop before boot completes.
- It assumed the pre-cut per-part backgrounds line up at the seams. They don't, so `bg-big.jpg` is used instead.
