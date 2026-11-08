# Decisions

## Variant A – Gut Run

- **Canvas + DOM split.** The moving playfield (gut, obstacles, player) is drawn on one `<canvas>`. Everything static or UI-like (background, texture, cloud border, logo, headline, tutorial, endcards, mute) is DOM, animated with GSAP. Canvas keeps the per-frame work cheap; DOM keeps text and buttons accessible and easy to animate.
- **Scaling.** `#ad` is a 360×640 design-px stage scaled with a single `transform: scale()`. `scale = min(vw/360, vh/640)` uses `innerHeight`, which excludes the mobile browser toolbars. On phones taller than 9:16 the stage grows in height and is not letterboxed: the logo bar stays at the top, the rest is centred, and the gut wall below the border is extended with its flat colour (`#d89c95`, the bottom row of `border.png`). Nothing is cropped and nothing is distorted.
- **Positions** were measured, not guessed. A small template-matching script finds each sprite in `design/*.png`. Full-frame layers (720×1280) are placed at 0/0. Gut start offset: 2 px. Player at 55.5/258.5. CTA, replay and gesture positions were matched the same way.
- **Collision.** Each sprite gets a 1-bit alpha mask at design resolution, eroded by 1 px. Hits are mask-vs-mask after a bounding-box pre-check. The cloud border uses its own mask, so its wavy edge is respected. `?debug=1` draws the masks; `?debug=1&auto=1` runs a bot that plays through a run, to check that generated courses are winnable. When opened via `file://`, `getImageData` is blocked, so the code falls back to ellipse hitboxes.
- **Course.** All 15 obstacles appear exactly once per run, shuffled. A random "safe path" is walked first and each obstacle is placed above or below it with a 160 px free gap. Long words grow out of the walls. Speed ramps from 105 to 145 px/s.
- **Difficulty tuning (tested, not guessed).** The bot (`?debug=1&auto=1&turbo=8`, turbo = fast-forward) showed two problems. First, a single jump (≈61 px) was higher than the free space above the player in the gap (≈51 px), so one tap could hit the word above. The jump is now ≈53 px and the gap 160 px. Second, gap centres could move ±95 px between neighbours, which left a band only ~24 px high that works for both obstacles. The step is now ±70 px (band ≥ ~50 px). Result: 33 of 34 bot runs won; the one loss had a valid gap.
- **Get ready.** The first tap starts the music, the tutorial and start-screen decoration pop away, and the player glides to the middle of the corridor (1.1 s) before gravity starts. Without this, the player starts 24 px below the top wall and the first tap would be an instant death.
- **Audio.** Web Audio API. Files are fetched on load and decoded only after the first tap (autoplay rules). One master gain handles mute, and `AudioContext.suspend()` runs while hidden. The music loop is guarded, so there's never a second loop. Replay stops all sources.
- **Replay** kills the run timeline, reverts the endcard's `gsap.context` (removes every tween and loop, plus inline styles), stops all sounds and builds a new course. A single rAF loop lives for the whole ad and is only cancelled while hidden, so speed can't double.
- **Visibility.** `visibilitychange` plus an `IntersectionObserver` (<50 % visible) pause the rAF loop, the GSAP global timeline and audio.

## Variant B – Fireplace

- **Background: `bg-big.jpg` for all three parts.** The per-part `bg.jpg` cuts do **not** line up at the seams: the rock is cut off between top and right, the colours jump, and the right cut is about 12 % larger in scale. Each part holds the full 1680×975 layer, shifted to its own window, and zooms around the centre of the whole fireplace. Because the transform is identical, the seams stay aligned even mid-animation, as long as the parts run in sync.
- **Geometry.** 320 + 4 + 1032 + 4 + 320 = 1680 = width of `bg-big`, so I assume a 4 px gap between the parts (the layout screenshot shows about 5 px at its ~97.6 % zoom).
- **Sync.** Each part posts `fireplace:ready` to its parent. `preview.html` sends `fireplace:start` to all three once every part is ready. Standalone, or without a start signal within 2 s, a part starts by itself.
- **Assets without transparency.** `box.png`, `left/hl.png`, `right/hl.png` and `cta.png` have an opaque black background. I didn't edit the assets:
  - copy: `mix-blend-mode: screen`. For white text on black this is mathematically the same as alpha.
  - panel: `clip-path` down to the blue band (rows 1489–1827 @2x), at opacity 0.9. The layout shows a little moss texture through the panel.
  - CTA: `border-radius: 5px; overflow: hidden` hides the black corners.
- **Products are baked into the background**, so they can't slide in on their own. The intro uses a background zoom-in (1.12 → 1, 5 s), logo, panel, copy, then the CTA last. The top headline builds line by line: the same image in three clipped bands.
- After the intro: background "breathing" (scale 1 ↔ 1.03, 4 × 6 s) and a CTA pulse. Both stop after about 30 s. `prefers-reduced-motion` shows the final state with no motion.
- `?overlay=1` (also on `preview.html`) places `design/layout.png` at 50 % on top of each part.


## Weight

- Variant A: about 2.1 MB of assets (audio ~1.37 MB of that), plus GSAP from cdnjs.
- Variant B: `bg-big.jpg` alone is 2.0 MB. TODO: recompress, and/or cut per-part crops with a margin for the zoom. The per-part `bg.jpg` files are not used.
