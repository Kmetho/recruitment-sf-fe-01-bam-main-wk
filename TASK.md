# Take-home task: Junior Frontend Engineer (SF-FE-01-BAM)

Hi, and thanks for applying to We The Folks.

This task is a small version of what you would do in your first weeks with us: take a designer's layout and a folder of exported assets and turn them into a working, animated rich media ad. It is based on real campaigns our team shipped this autumn.

**Please complete both variants below.** Both are scored on the same criteria.

- **Variant A: Game Ad** (a mobile tap-to-jump mini game)
- **Variant B: Fireplace Ad** (a three-part animated desktop skin)

**Scope:** a smaller, finished and polished ad beats a bigger, half-done one.
**Deadline:** 4 days from the moment you receive the email with this task.
**Questions:** reply to the email with this task at any time. Asking a good question is a plus, not a minus.

---

## Ground rules (both variants)

1. **Plain HTML, CSS (or SCSS) and modern JavaScript (ES6+).** No UI frameworks (no React, Vue, Angular, Svelte). Ads have to load fast and run everywhere.
2. **Allowed libraries:** GSAP for animation. For Variant A you may also use Phaser or write the game on a plain `<canvas>` or DOM, your choice. A bundler (Vite, webpack, esbuild) is optional. Opening `index.html` through a local server is enough.
3. **Use the provided assets.** All images are exported at **2x**, so render them at 50% of their pixel size. Don't redraw or replace them. Positions should match the design files as closely as you can measure them, not "by eye".
4. **Clickout:** every CTA must open the landing page in a new window through a click tag:
   ```js
   const clickTag = window.clickTag || 'https://example.com/landing';
   ```
5. **Weight:** keep the total ad (all files you ship) under **3 MB**. Compress assets if you need to, and tell us what you did.
6. **AI tools are welcome.** We work AI-first every day (Claude Code, Playwright). Use whatever you like, but you must understand and be able to explain every line you submit. Tell us briefly how you used AI and where you had to correct it.
7. **Confidentiality:** the assets are adapted from real campaigns, with logos and packaging replaced by placeholders, and are shared with you only for this exercise. Please use them only for this task.

---

## Variant A: Game Ad ("Gut Run")

A mobile fullscreen ad with a Flappy-Bird-style mini game for a campaign about gut health. The player guides a smiling poo emoji through a stylised gut and avoids obstacles.

**Files:** `variant-a-game/`
- `design/00-concept.png`: concept slide with the game description (German)
- `design/01-start.png`, `02-fail-endcard.png`, `03-win-endcard.png`: target screens
- `assets/`: all layers (720x1280 @2x), obstacles, texts, endcards, music and sound effects

**Format:** portrait mobile, designed at **360x640 CSS px** (assets 720x1280). The ad must fill the visible viewport of real phones (roughly 320x568 up to 430x932) without distortion and without anything important being cut off. Pay attention to mobile browser toolbars.

**Required behaviour**
1. **Start screen:** logo bar, headline and the tutorial overlay (`tut.png`, `gesture.png`, "tap to run"). The game starts on the first tap.
2. **Gameplay**
   - The player stays on the same vertical line (x is fixed). A tap makes it jump up. Without taps it falls (gravity).
   - The gut (`gameplay.png`) and the obstacles move from right to left.
   - Obstacles: the bacteria (`bac1` to `bac6`) and the text obstacles (`txt1` to `txt9`, e.g. "Stress", "Tabu"). **Each obstacle appears exactly once per run.**
   - Touching an obstacle, or leaving the playfield at the top or bottom, ends the run with the **fail endcard**.
   - Reaching the end of the gut after all obstacles have passed shows the **win endcard**.
3. **Collision must feel fair.** The player should never "die" when it visibly did not touch anything. Hitboxes based on the full rectangular image are usually too big.
4. **Fail endcard:** sad poo, bacteria, headline, CTA (clickout) and a **replay** button that restarts the game cleanly (no leftover timers, doubled speed, or duplicated sounds).
5. **Win endcard:** happy poo, confetti, headline and CTA (clickout). Play the applause / cheer sound.
6. **Sound:** background music loop during the game, crash sound on hit, fail and win sounds on the endcards. Audio may only start after the first user interaction (browser autoplay rules). Add a small **mute toggle**.
7. **Animation:** at least an intro animation on the start screen and an animated entrance of the endcard elements (e.g. confetti, bouncing poo, CTA). Use easing, avoid abrupt stops.
8. **Pause** the game and sound when the tab or ad is not visible (`visibilitychange`) and resume cleanly.

**Nice to have:** a short "get ready" moment before obstacles arrive; gentle difficulty ramp; `prefers-reduced-motion` support for decorative animations; a debug mode (e.g. `?debug=1`) that draws hitboxes.

---

## Variant B: Fireplace Ad

A desktop "fireplace" skin for a cough and cold campaign: a top banner plus a left and a right skyscraper that frame the publisher's website. No interaction is planned besides the clickout. The goal is that it is **beautifully animated**.

**Files:** `variant-b-fireplace/`
- `design/layout.png`: target layout of all three parts
- `assets/top/`, `assets/left/`, `assets/right/`: background, headline, logo layers for each part (2x)
- `assets/box.png` (text panel), `assets/cta.png` (button), `assets/bg-big.jpg` (one continuous background for the whole fireplace)

**Format:** three separate creatives that run side by side, built from 2x assets:
- **Top:** 1032x250 CSS px (assets 2064x500)
- **Left** and **Right:** 320x975 CSS px (assets 640x1950)

Build each part as its own HTML file (`top.html`, `left.html`, `right.html`) because in production they are delivered as three separate ads. Add a `preview.html` that places the three parts (e.g. in iframes) like in `design/layout.png`, with an empty area in the middle where the website would be.

**Required behaviour**
1. **Pixel-accurate layout** matching `design/layout.png`: logo, product, text panel, copy and CTA in the right place and size on each skyscraper; three-line headline on the top banner.
2. **Continuous background:** the moss background must look like one surface across all three parts. When they sit next to each other, the seams should line up. `bg-big.jpg` is provided for this, the per-part `bg.jpg` files are pre-cut versions. Decide which approach you use and explain why.
3. **Intro animation** (roughly 3 to 6 seconds), coordinated across the three parts. For example: background slowly zooms in, logos fade/scale in, product slides in and **eases** to a stop, text panel and copy reveal, headline on the top banner builds line by line, CTA appears last.
4. **After the intro**, keep it alive but calm: e.g. a subtle background zoom or drift and a gentle CTA pulse. It must not distract from the website content. Stop or reduce looping animation after about 30 seconds.
5. **Clickout:** clicking anywhere on a part (or at least on the CTA) opens the click tag.
6. **Performance:** animations should run smoothly on an average laptop. Animate `transform` and `opacity`, not layout properties. Respect `prefers-reduced-motion` (show the final state without motion).

**Nice to have:** the three parts start their animation in sync even though they are separate documents (e.g. via `postMessage` from the preview page); a debug overlay that shows the design layout at 50% opacity on top of your build so you can check alignment.

---

## Deliverables (both variants)

1. **A new public GitHub repository.** Do not fork this repository: create your own and copy the files you need. Send us the link in a reply to the email with this task. We read the commit history, so commit as you go rather than one big final commit.
2. **README.md** with:
   - how to run it locally (one or two commands at most),
   - what you would do next with more time,
   - any known issues or shortcuts you took.
3. **DECISIONS.md:** a short decision log (bullet points are fine). Examples: how you scaled the ad to the viewport, how you did collision / how you aligned the background, how you handled audio, why you picked canvas vs DOM, what you compressed.
4. **AI note** (a few sentences, in the README is fine): which tools you used, for what, and one example where the output was wrong and you fixed it.
5. Optional: a short screen recording (under 1 minute).

Everything you submit must be stored in the repository, including the optional recording.

Reply to the email with this task with the repository link when you are done.