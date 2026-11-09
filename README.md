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

- Recompress `bg-big.jpg`, or ship per-part crops of it so each separate ad downloads less.
- Ask for a separate product PNG so the product can slide in on its own (it is baked into the background).
- Test on real devices.
- Re-encode the audio (the applause file alone is 600 KB) and trim the music loop.
- Self-host GSAP for ad servers that don't allow CDNs.

## Known issues / shortcuts

- Copy in some assets doesn't match the designs (see QUESTIONS.md); I used the assets as delivered.
- `box.png`, `cta.png` and the skyscraper `hl.png` files have no transparency. This is handled in CSS (clip-path, `mix-blend-mode: screen`, border-radius) instead of editing the assets.
- Variant B assumes a 4 px gap between the parts (1680 = 320 + 4 + 1032 + 4 + 320).
- Opened via `file://`, the game falls back to ellipse hitboxes and has no sound.
- Not tested on real phones, only in desktop browser emulation.

## How I used AI

I used **Claude Code** (desktop app) for this task, and to be clear about the split: the AI wrote most of the code and the first drafts of the docs. My part was directing, constraining, running and reviewing it.

**What the AI did**
- Wrote the HTML, CSS and JavaScript for both variants.
- Tested the game in its built-in browser at phone sizes, including a debug bot that plays many runs in a row.
- Drafted this README, `DECISIONS.md` and `QUESTIONS.md`.

**What I did**
- Set the scope and the rules. When it started measuring everything at once, I told it to build a working skeleton first and leave the pixel polish to me. When it set up its own dev server and installed extra tools, I had it remove them.
- Run the server myself.
- Ran both ads locally and reported what went wrong.
- Made the project decisions.

**Where the AI output was wrong**

Most of these were caught by the AI's own testing, not by me. That's exactly why I had it test instead of trusting the first version:

- **Win screen never appeared.** It added tweens to a GSAP timeline that had already finished. GSAP removes finished timelines, so the win animation silently never ran. Fixed by starting a fresh timeline for each phase of a run.
- **The game was unfairly hard.** One jump rose about 61 px, but the free space above the player in a gap was only about 51 px, so a single tap could hit the obstacle above. Neighbouring gaps could also leave a band only ~24 px high. The bot won 7 of 12 runs. After retuning (smaller jump, bigger gap, smaller height changes) it won 33 of 34.
- **Fireplace zoom broke the seams.** The first version gave each part only its own slice of the background and zoomed it around the centre of the whole fireplace, which pulled the image away from the outer edges. Fixed by giving every part the full background layer, shifted to its window.
- **Wrong assumption about the assets.** It assumed the pre-cut backgrounds line up at the seams (they don't) and that the PNGs have transparency (four of them don't). Both only showed up once it compared and rendered them.
- **Its own test tool was wrong too.** The first fast-forward mode sped up the physics but not GSAP. That produced fake crashes, which it first blamed on the game.
