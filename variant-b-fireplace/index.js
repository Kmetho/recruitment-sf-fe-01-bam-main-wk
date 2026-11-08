/* Fireplace – shared script for top.html, left.html and right.html.
 *
 * Each part is its own document (separate ads in production). They share:
 *   - one continuous background (bg-big.jpg) – every part shows its own window of it,
 *   - one intro timeline with identical timings, started in sync by preview.html via postMessage
 *     (standalone, each part starts by itself).
 */
(() => {
  'use strict';

  const getClickTag = () => window.clickTag || 'https://example.com/landing';
  const params = new URLSearchParams(location.search);
  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Layout config (CSS px) ──────────────────────────────────────────────
  // Where each part sits on the 1680x975 bg-big.jpg. 320 + 4 + 1032 + 4 + 320 = 1680,
  // so the parts are assumed to have a 4px gap between them (as in design/layout.png).
  const BG = { width: 1680, height: 975 };
  const PARTS = {
    left: { bgX: 0, overlay: [28, 50] },
    top: { bgX: 324, overlay: [345, 50] },
    right: { bgX: 1360, overlay: [1351, 50] },
  };
  const LAYOUT_SCALE = 0.976; // design/layout.png is a screenshot at ~97.6% zoom
  const TOP_LINES = [
    [0, 82.5],
    [82.5, 145],
    [145, 250],
  ]; // y-bands of the three lines in top/hl.png
  const IDLE_SECONDS = 30; // looping animation stops after ~30 s

  const part = document.querySelector('.part');
  const name = part.dataset.part;
  const cfg = PARTS[name];
  const $ = (s) => part.querySelector(s);
  const $$ = (s) => [...part.querySelectorAll(s)];

  // ─── Background window ───────────────────────────────────────────────────
  // The layer is the whole 1680x975 fireplace, moved so this part's window is visible. All parts scale
  // it around its centre (= same physical point), so while zooming the seams keep lining up.
  const bg = $('.bg');
  bg.style.left = `${-cfg.bgX}px`;
  gsap.set(bg, { transformOrigin: `${BG.width / 2}px ${BG.height / 2}px` });

  // Top headline bands
  $$('.hl-line').forEach((band, i) => {
    const [y0, y1] = TOP_LINES[i];
    band.style.top = `${y0}px`;
    band.style.height = `${y1 - y0}px`;
    band.querySelector('img').style.top = `${-y0}px`;
  });

  // ?overlay=1 → design on top at 50%
  if (params.has('overlay')) {
    const o = document.createElement('div');
    o.className = 'design-overlay';
    const [ox, oy] = cfg.overlay;
    o.style.backgroundSize = `${1684 / LAYOUT_SCALE}px auto`;
    o.style.backgroundPosition = `${-ox / LAYOUT_SCALE}px ${-oy / LAYOUT_SCALE}px`;
    part.appendChild(o);
  }

  // ─── Clickout: anywhere on the part ──────────────────────────────────────
  part.addEventListener('click', () => window.open(getClickTag(), '_blank'));

  // ─── Animation ───────────────────────────────────────────────────────────
  // Hidden start state is set immediately (before images finish loading) to avoid a flash.
  const intro = gsap.timeline({ paused: true, onComplete: idle });

  if (REDUCED_MOTION) {
    // final state, no motion
  } else if (name === 'top') {
    intro.fromTo(bg, { scale: 1.12 }, { scale: 1, duration: 5, ease: 'power2.out' }, 0);
    $$('.hl-line img').forEach((img, i) => {
      const h = TOP_LINES[i][1] - TOP_LINES[i][0];
      intro.from(img, { y: h * 0.8, autoAlpha: 0, duration: 0.8, ease: 'power3.out' }, 0.6 + i * 0.5);
    });
  } else {
    intro
      .fromTo(bg, { scale: 1.12 }, { scale: 1, duration: 5, ease: 'power2.out' }, 0)
      .from($('.logo'), { scale: 0.85, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.7)', transformOrigin: '160px 125px' }, 0.4)
      .from($('.box'), { y: 60, autoAlpha: 0, duration: 0.9, ease: 'power3.out' }, 1.4)
      .from($('.copy'), { y: 20, autoAlpha: 0, duration: 0.8, ease: 'power3.out' }, 1.9)
      .from($('.cta'), { scale: 0.6, autoAlpha: 0, duration: 0.6, ease: 'back.out(2)' }, 3.2);
  }
  intro.progress(0);

  // Calm loop after the intro, stops after IDLE_SECONDS
  function idle() {
    if (REDUCED_MOTION) return;
    const breathe = 6; // seconds per half cycle → 4 halves = 24 s (+ ~5 s intro ≈ IDLE_SECONDS)
    gsap.to(bg, {
      scale: 1.03,
      duration: breathe,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 3, // odd repeat count → ends back at scale 1
    });
    const cta = $('.cta');
    if (cta) gsap.to(cta, { scale: 1.05, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 15, repeatDelay: 0.4 });
  }

  // ─── Sync start ──────────────────────────────────────────────────────────
  let started = false;
  function start() {
    if (started) return;
    started = true;
    intro.play(0);
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'fireplace:start') start();
  });

  const imagesLoaded = Promise.all(
    [...document.images].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r))))
  );
  const bgLoaded = new Promise((r) => {
    const i = new Image();
    i.onload = i.onerror = r;
    i.src = 'assets/bg-big.jpg';
  });

  Promise.all([imagesLoaded, bgLoaded]).then(() => {
    if (window.parent !== window) {
      // Inside preview.html: report ready and wait for the shared start signal (fallback after 2 s)
      window.parent.postMessage({ type: 'fireplace:ready', part: name }, '*');
      setTimeout(start, 2000);
    } else {
      start();
    }
  });
})();
