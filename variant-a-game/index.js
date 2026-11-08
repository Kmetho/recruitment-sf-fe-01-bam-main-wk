/* Gut Run – mobile game ad (Variant A)
 *
 * Rendering split:
 *   - DOM  : static layers (background, texture, border, logo, headline), tutorial, endcards, mute button.
 *            These are animated with GSAP (transform/opacity only).
 *   - Canvas: the moving playfield only (gut, obstacles, player), redrawn every frame.
 *
 * All coordinates are in "design px": the 360x640 design space (= @2x assets at 50%).
 */
(() => {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  const getClickTag = () => window.clickTag || 'https://example.com/landing';

  const params = new URLSearchParams(location.search);
  const DEBUG = params.get('debug') === '1'; // draws hitboxes
  const AUTOPLAY = DEBUG && params.get('auto') === '1'; // simple bot, used to test that every course is winnable
  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const W = 360;
  const H = 640;
  const PLAYFIELD_TOP = 168.5; // top edge of border.png (y=337 @2x); the canvas is clipped above this line
  const GUT_WIDTH = 2528; // gameplay.png is 5056 px @2x
  const GUT_START = 2; // horizontal gut offset on the start screen, measured from design/01-start.png
  const RUN_LENGTH = GUT_WIDTH - W - GUT_START; // scroll distance until the end of the gut reaches the right edge
  const CORRIDOR = { top: 234, bottom: 573 }; // inner edges of the cloud border (border.png alpha, avg.)

  const PLAYER = { x: 55.5, y: 258.5, w: 42, h: 41 }; // start position measured from design/01-start.png
  const PHYS = { gravity: 1500, jump: -430, maxFall: 640 }; // px/s², px/s
  const SPEED = { start: 105, end: 145 }; // scroll speed in px/s, ramps up linearly over the run
  const GET_READY = 1.1; // seconds between first tap and gravity kicking in
  const PATH_CLEARANCE = 72; // half of the guaranteed free gap around the generated safe path

  const OBSTACLES = [
    'bac1', 'bac2', 'bac3', 'bac4', 'bac5', 'bac6',
    'txt1', 'txt2', 'txt3', 'txt4', 'txt5', 'txt6', 'txt7', 'txt8', 'txt9',
  ];

  const IMAGES = {
    gut: 'assets/01_game/gameplay.png',
    player: 'assets/01_game/player.png',
    border: 'assets/border.png',
  };
  OBSTACLES.forEach((k) => (IMAGES[k] = `assets/01_game/${k}.png`));

  const SOUNDS = {
    music: 'assets/music/background_music/Funny%20Game%20Loop.mp3',
    crash: 'assets/music/crash/Cartoon%20Crash%20Boing.mp3',
    fail: 'assets/music/endcard_fail/Fail.mp3',
    cheer: 'assets/music/endcard_win/Celebrative%20Happy%20Woohoo%20Cheer%202.mp3',
    applause: 'assets/music/endcard_win/applause.mp3',
  };

  // ─── DOM ───────────────────────────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const ad = $('#ad');
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const confettiCanvas = $('#confetti');
  const confettiCtx = confettiCanvas.getContext('2d');
  const muteBtn = $('#mute');
  const failCard = $('#fail');
  const winCard = $('#win');

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    });

  // ─── Collision masks ───────────────────────────────────────────────────────
  // Rectangle hitboxes are unfair for round/diagonal sprites, so every sprite gets a 1-bit alpha
  // mask at design resolution (1 cell = 2x2 asset px). Masks are eroded by 1 px so that touching
  // anti-aliased edges never counts as a hit.
  function buildMask(img) {
    const w = Math.ceil(img.naturalWidth / 2);
    const h = Math.ceil(img.naturalHeight / 2);
    const bits = new Uint8Array(w * h);
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, c.width, c.height).data;
      const alpha = (x, y) => (x < c.width && y < c.height ? data[(y * c.width + x) * 4 + 3] : 0);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = alpha(2 * x, 2 * y) + alpha(2 * x + 1, 2 * y) + alpha(2 * x, 2 * y + 1) + alpha(2 * x + 1, 2 * y + 1);
          bits[y * w + x] = a > 4 * 128 ? 1 : 0;
        }
      }
    } catch (err) {
      // getImageData is blocked when the page is opened via file:// (tainted canvas).
      // Fall back to an ellipse covering ~85% of the sprite.
      console.warn('[gut-run] pixel masks unavailable, using ellipse hitboxes. Serve the folder over http.', err);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x + 0.5 - w / 2) / (w * 0.425);
          const ny = (y + 0.5 - h / 2) / (h * 0.425);
          bits[y * w + x] = nx * nx + ny * ny <= 1 ? 1 : 0;
        }
      }
    }
    return { w, h, bits: erode(bits, w, h) };
  }

  function erode(bits, w, h) {
    const out = new Uint8Array(bits.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        out[i] = bits[i] & bits[i - 1] & bits[i + 1] & bits[i - w] & bits[i + w];
      }
    }
    return out;
  }

  // Do mask A at (ax, ay) and mask B at (bx, by) share a solid design pixel?
  function masksOverlap(a, ax, ay, b, bx, by) {
    const x0 = Math.max(ax, bx);
    const y0 = Math.max(ay, by);
    const x1 = Math.min(ax + a.w, bx + b.w);
    const y1 = Math.min(ay + a.h, by + b.h);
    if (x0 >= x1 || y0 >= y1) return false; // bounding boxes don't even touch
    for (let y = Math.floor(y0); y < y1; y++) {
      const ra = Math.floor(y - ay) * a.w;
      const rb = Math.floor(y - by) * b.w;
      for (let x = Math.floor(x0); x < x1; x++) {
        const ia = Math.floor(x - ax);
        const ib = Math.floor(x - bx);
        if (ia < 0 || ib < 0 || ia >= a.w || ib >= b.w) continue;
        if (a.bits[ra + ia] && b.bits[rb + ib]) return true;
      }
    }
    return false;
  }

  // ─── Audio (Web Audio API) ─────────────────────────────────────────────────
  // Files are fetched on load, but decoded/played only after the first tap (autoplay rules).
  // One master gain node = one place for mute; the AudioContext is suspended while hidden.
  const sound = {
    ctx: null,
    master: null,
    raw: {}, // ArrayBuffers, fetched up front
    buffers: {}, // decoded AudioBuffers
    active: new Set(),
    music: null,
    wantMusic: false,
    muted: false,

    prefetch() {
      Object.entries(SOUNDS).forEach(([name, url]) => {
        this.raw[name] = fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
          .catch((err) => console.warn(`[gut-run] sound "${name}" unavailable`, err));
      });
    },

    // Must be called from a user gesture.
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      Object.keys(SOUNDS).forEach((name) => {
        Promise.resolve(this.raw[name])
          .then((ab) => ab && new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
          .then((buf) => {
            if (!buf) return;
            this.buffers[name] = buf;
            if (name === 'music' && this.wantMusic && !this.music) this.startMusic();
          })
          .catch((err) => console.warn(`[gut-run] could not decode "${name}"`, err));
      });
    },

    play(name, { volume = 1, loop = false } = {}) {
      const buf = this.buffers[name];
      if (!this.ctx || !buf) return null;
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buf;
      src.loop = loop;
      gain.gain.value = volume;
      src.connect(gain).connect(this.master);
      src.onended = () => this.active.delete(src);
      this.active.add(src);
      src.start();
      return src;
    },

    startMusic() {
      this.wantMusic = true;
      if (this.music) return; // never start a second loop
      this.music = this.play('music', { volume: 0.55, loop: true });
    },

    stopMusic() {
      this.wantMusic = false;
      if (this.music) {
        try {
          this.music.stop();
        } catch (e) {
          /* already stopped */
        }
        this.music = null;
      }
    },

    stopAll() {
      this.stopMusic();
      this.active.forEach((src) => {
        try {
          src.stop();
        } catch (e) {
          /* already stopped */
        }
      });
      this.active.clear();
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    },

    suspend() {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  // state: loading → intro → start → getready → play → crash|won → end
  let state = 'loading';
  let images = {};
  let masks = {};
  let course = []; // obstacles of the current run
  let scale = 1;
  let extra = 0; // extra stage height in design px
  let dpr = 1;
  let rafId = 0;
  let lastTime = 0;
  let introTl = null;
  let runTl = null; // all tweens belonging to the current run (killed on replay)
  let endCtx = null; // gsap.context for the visible endcard (reverted on replay)
  let confettiParticles = [];

  // Values that GSAP tweens and the renderer reads
  const view = {
    gutX: GUT_START, // how far the gut has scrolled
    gutAlpha: 1,
    speed: 0,
    playerY: PLAYER.y,
    playerOffsetY: 0, // visual-only offset (intro drop, idle bob)
    playerOffsetX: 0,
    playerRot: 0,
    playerScale: 1,
    playerAlpha: 1,
  };
  let vy = 0;
  let scroll = 0;
  let lastHit = null; // what ended the last run (debug info)

  // ─── Layout: fit the 360x640 stage into the viewport ───────────────────────
  // The stage is scaled to the viewport width (or height on wide screens) without distortion.
  // If the phone is taller than 9:16 the stage grows in height instead of being letterboxed:
  // content below the logo bar is centred and the gut wall is extended with its flat colour.
  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight; // innerHeight = the area left between the mobile browser toolbars
    scale = Math.min(vw / W, vh / H);
    const stageH = Math.max(H, vh / scale);
    extra = stageH - H;
    const left = (vw - W * scale) / 2;
    const top = (vh - stageH * scale) / 2;
    ad.style.setProperty('--extra', `${extra}px`);
    ad.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;

    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(stageH * scale * dpr);
    confettiCanvas.width = Math.round(W * scale * dpr);
    confettiCanvas.height = Math.round(H * scale * dpr);
    render();
  }

  // ─── Course generation ─────────────────────────────────────────────────────
  // Every obstacle appears exactly once per run, in random order. A random "safe path" is walked
  // through the corridor first, then each obstacle is placed above or below it, so there is always
  // a free gap of 2 * PATH_CLEARANCE px, and the path never moves further than a player can follow.
  function buildCourse() {
    const keys = shuffle([...OBSTACLES]);
    const firstX = 420; // world x of the first obstacle → arrives ~2.5 s after the first tap
    const lastX = RUN_LENGTH + PLAYER.x - 110; // last obstacle has fully passed before the gut ends
    const step = (lastX - firstX) / (keys.length - 1);
    let path = PLAYER.y + PLAYER.h / 2 + 120; // start near the middle of the corridor

    return keys.map((key, i) => {
      const img = images[key];
      const w = img.naturalWidth / 2;
      const h = img.naturalHeight / 2;
      path = clamp(path + rand(-95, 95), CORRIDOR.top + 75, CORRIDOR.bottom - 75);

      const isText = key.startsWith('txt');
      const roomAbove = path - PATH_CLEARANCE - CORRIDOR.top;
      const roomBelow = CORRIDOR.bottom - (path + PATH_CLEARANCE);
      let above;
      if (isText) above = roomAbove > roomBelow;
      else if (roomAbove >= h && roomBelow >= h) above = Math.random() < 0.5;
      else above = roomAbove >= h;

      let y;
      if (isText) {
        // Long words grow from the wall towards the path (part of them may hide behind the cloud border)
        y = above ? path - PATH_CLEARANCE - h : path + PATH_CLEARANCE;
      } else {
        const room = Math.max(0, (above ? roomAbove : roomBelow) - h);
        const off = rand(0, Math.min(room, 45));
        y = above ? path - PATH_CLEARANCE - h - off : path + PATH_CLEARANCE + off;
      }

      return { key, img, mask: masks[key], x: firstX + i * step + rand(-12, 12), y, w, h, path };
    });
  }

  // ─── Game flow ─────────────────────────────────────────────────────────────
  // A finished GSAP timeline is removed from the global timeline, so tweens added to it later
  // would never play. Every phase of a run therefore starts a fresh timeline.
  function newRunTimeline() {
    if (runTl) runTl.kill();
    runTl = gsap.timeline();
    return runTl;
  }

  function resetRun() {
    newRunTimeline();
    scroll = 0;
    vy = 0;
    course = buildCourse();
    Object.assign(view, {
      gutX: GUT_START,
      gutAlpha: 1,
      speed: 0,
      playerY: PLAYER.y,
      playerOffsetY: 0,
      playerOffsetX: 0,
      playerRot: 0,
      playerScale: 1,
      playerAlpha: 1,
    });
  }

  function startRun() {
    state = 'getready';
    sound.unlock();
    sound.startMusic();

    if (introTl) {
      introTl.progress(1).kill();
      introTl = null;
    }
    gsap.killTweensOf(['#gesture', view]);

    // Tutorial and start-screen decoration leave, the player glides to the middle of the corridor.
    runTl
      .to('#gesture', { autoAlpha: 0, scale: 0.8, duration: 0.25, ease: 'power2.in', transformOrigin: '60% 40%' }, 0)
      .to('.decor', { autoAlpha: 0, scale: 0, duration: 0.3, stagger: 0.05, ease: 'back.in(2)' }, 0)
      .to(view, { playerOffsetY: 0, duration: 0.2 }, 0)
      .to(view, { playerY: 365, duration: GET_READY, ease: 'sine.inOut' }, 0)
      .to(view, { speed: SPEED.start, duration: GET_READY, ease: 'power1.in' }, 0)
      .add(() => {
        state = 'play';
        vy = PHYS.jump * 0.6; // small hop as "go" signal
      }, GET_READY);
  }

  function jump() {
    vy = PHYS.jump;
  }

  function crash() {
    state = 'crash';
    sound.stopMusic();
    sound.play('crash', { volume: 0.9 });
    if (navigator.vibrate) navigator.vibrate(60);

    // short "ouch": shake, then fall out of the picture
    newRunTimeline()
      .to(view, { playerOffsetX: 4, duration: 0.05, yoyo: true, repeat: 5, ease: 'none' })
      .to(view, { playerRot: 0.6, playerOffsetY: 40, playerAlpha: 0, duration: 0.45, ease: 'power2.in' })
      .add(showFail, '+=0.1');
  }

  function win() {
    state = 'won';
    sound.stopMusic();
    newRunTimeline()
      .to(view, { speed: 0, duration: 0.3, ease: 'power2.out' }, 0)
      .to(view, { playerOffsetX: 380, playerRot: 0.2, duration: 0.7, ease: 'power2.in' }, 0)
      .add(showWin, 0.6);
  }

  function replay() {
    hideEndcards();
    sound.stopAll();
    resetRun();
    // Replay goes straight into the run (no tutorial): the replay tap already was the user gesture.
    gsap.set('.decor', { autoAlpha: 0 });
    gsap.set('#gesture', { autoAlpha: 0 });
    gsap.fromTo('#scene', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
    startRun();
  }

  // ─── Update & render ───────────────────────────────────────────────────────
  function update(dt) {
    if (state === 'getready' || state === 'play' || state === 'won') {
      scroll = Math.min(scroll + view.speed * dt, RUN_LENGTH);
      view.gutX = GUT_START + scroll;
    }

    if (state === 'play') {
      const progress = scroll / RUN_LENGTH;
      view.speed = SPEED.start + (SPEED.end - SPEED.start) * progress;

      if (AUTOPLAY) autopilot();

      vy = Math.min(vy + PHYS.gravity * dt, PHYS.maxFall);
      view.playerY += vy * dt;
      view.playerRot = clamp(vy / PHYS.maxFall, -0.5, 1) * 0.35;

      lastHit = hitTest();
      if (lastHit) {
        crash();
        return;
      }

      const allPassed = course.every((o) => o.x + o.w - scroll < PLAYER.x);
      if (scroll >= RUN_LENGTH && allPassed) win();
    }
  }

  // Returns what was hit (for ?debug=1), or null
  function hitTest() {
    const py = view.playerY;
    // Leaving the playfield at the top or bottom
    if (py + PLAYER.h / 2 < PLAYFIELD_TOP + 20 || py + PLAYER.h / 2 > H) return 'out of playfield';
    // Touching the cloud border (pixel mask, so the wavy edge is respected)
    if (masksOverlap(masks.player, PLAYER.x, py, masks.border, 0, 0)) return py < H / 2 ? 'top wall' : 'bottom wall';
    // Obstacles
    for (const o of course) {
      const ox = o.x - scroll;
      if (ox > PLAYER.x + PLAYER.w || ox + o.w < PLAYER.x) continue;
      if (masksOverlap(masks.player, PLAYER.x, py, o.mask, ox, o.y)) return o.key;
    }
    return null;
  }

  // Debug bot: tap whenever the player sinks below the safe path of the next obstacle.
  function autopilot() {
    const next = course.find((o) => o.x + o.w - scroll > PLAYER.x - 10) || { path: 400 };
    const center = view.playerY + PLAYER.h / 2;
    if (center > next.path + 8 && vy > -60) jump();
  }

  function render() {
    if (!images.gut) return;
    const k = scale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H + extra);
    ctx.save();
    ctx.translate(0, extra / 2);
    ctx.beginPath();
    ctx.rect(0, PLAYFIELD_TOP, W, H - PLAYFIELD_TOP);
    ctx.clip();

    // Gut: only the visible 360px slice of the 2528px strip is copied each frame
    ctx.globalAlpha = view.gutAlpha;
    const sx = clamp(view.gutX, 0, GUT_WIDTH - W);
    ctx.drawImage(images.gut, sx * 2, 0, W * 2, H * 2, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // Obstacles
    for (const o of course) {
      const ox = o.x - scroll;
      if (ox > W || ox + o.w < 0) continue;
      ctx.drawImage(o.img, ox, o.y, o.w, o.h);
    }

    // Player
    if (state !== 'end' && state !== 'loading') {
      ctx.save();
      ctx.globalAlpha = view.playerAlpha;
      ctx.translate(PLAYER.x + PLAYER.w / 2 + view.playerOffsetX, view.playerY + PLAYER.h / 2 + view.playerOffsetY);
      ctx.rotate(view.playerRot);
      ctx.scale(view.playerScale, view.playerScale);
      ctx.drawImage(images.player, -PLAYER.w / 2, -PLAYER.h / 2, PLAYER.w, PLAYER.h);
      ctx.restore();
    }

    if (DEBUG) drawDebug();
    ctx.restore();
  }

  function drawMask(mask, x, y, color) {
    ctx.fillStyle = color;
    for (let j = 0; j < mask.h; j++) {
      for (let i = 0; i < mask.w; i++) {
        if (mask.bits[j * mask.w + i]) ctx.fillRect(x + i, y + j, 1, 1);
      }
    }
  }

  function drawDebug() {
    drawMask(masks.player, PLAYER.x, view.playerY, 'rgba(0,255,0,.45)');
    for (const o of course) {
      const ox = o.x - scroll;
      if (ox > W || ox + o.w < 0) continue;
      drawMask(o.mask, ox, o.y, 'rgba(255,0,0,.45)');
      ctx.strokeStyle = 'rgba(255,255,0,.6)';
      ctx.strokeRect(ox, o.y, o.w, o.h);
      ctx.fillStyle = 'cyan';
      ctx.fillRect(ox, o.path - 1, o.w, 2);
    }
    ctx.strokeStyle = 'rgba(255,0,255,.8)';
    ctx.beginPath();
    ctx.moveTo(0, CORRIDOR.top);
    ctx.lineTo(W, CORRIDOR.top);
    ctx.moveTo(0, CORRIDOR.bottom);
    ctx.lineTo(W, CORRIDOR.bottom);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`${state} scroll ${scroll | 0}/${RUN_LENGTH} speed ${view.speed | 0}`, 6, PLAYFIELD_TOP + 74);
  }

  // One rAF loop for the whole lifetime of the ad. It is cancelled while hidden and restarted once,
  // so replays can never stack loops or double the game speed.
  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min((now - lastTime) / 1000, 1 / 30); // clamp: no huge jumps after a hiccup
    lastTime = now;
    update(dt);
    render();
    if (confettiParticles.length) renderConfetti(dt);
  }

  function startLoop() {
    // The visibility observers fire right at page load; the loop must not run before boot() is done.
    if (rafId || state === 'loading') return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ─── Intro animation (start screen) ────────────────────────────────────────
  function playIntro() {
    state = 'intro';
    introTl = gsap.timeline({
      onComplete: () => {
        if (state === 'intro') state = 'start';
        idleStart();
      },
    });

    if (REDUCED_MOTION) {
      introTl.from(['#logo', '#headline', '#game', '.decor', '#gesture'], { autoAlpha: 0, duration: 0.4 });
      return;
    }

    introTl
      .from('#logo', { yPercent: -10, autoAlpha: 0, duration: 0.5, ease: 'power3.out' })
      .from('#texture', { autoAlpha: 0, duration: 0.6 }, 0.1)
      .from(view, { gutX: GUT_START + 70, gutAlpha: 0, duration: 0.9, ease: 'power3.out' }, 0.1)
      .from('#headline', { scale: 0.6, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.8)', transformOrigin: '50% 18%' }, 0.25)
      .from(view, { playerOffsetY: -260, duration: 0.9, ease: 'bounce.out' }, 0.45)
      .from('.decor', { scale: 0, autoAlpha: 0, duration: 0.45, stagger: 0.1, ease: 'back.out(2.2)' }, 0.75)
      .from('#gesture', { autoAlpha: 0, y: 20, duration: 0.4, ease: 'power2.out' }, 1.2);
  }

  // Gentle idle loops while waiting for the first tap
  function idleStart() {
    if (REDUCED_MOTION || state !== 'start') return;
    gsap.to(view, { playerOffsetY: -6, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to('#gesture', {
      keyframes: [
        { scale: 0.92, duration: 0.18, ease: 'power2.in' },
        { scale: 1, duration: 0.35, ease: 'back.out(3)' },
        { scale: 1, duration: 0.6 },
      ],
      transformOrigin: '60% 15%',
      repeat: -1,
    });
  }

  // ─── Endcards ──────────────────────────────────────────────────────────────
  // Origins = centre of each full-frame layer's opaque area (measured from the PNG alpha bbox)
  const ORIGIN = {
    bubble: '179.75px 235.25px',
    sadPoo: '180px 241.25px',
    happyPoo: '179.75px 365px',
    konfetti: '115px 165px', // mouth of the party hat
  };

  function showEndcard(card, build) {
    state = 'end';
    gsap.to('#scene', { autoAlpha: 0, duration: 0.3 });
    card.hidden = false;
    endCtx = gsap.context(() => build(gsap.timeline()), card);
  }

  function hideEndcards() {
    if (endCtx) {
      endCtx.revert(); // kills every tween/loop of the endcard and removes inline styles
      endCtx = null;
    }
    confettiParticles = [];
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    failCard.hidden = true;
    winCard.hidden = true;
  }

  function showFail() {
    sound.play('fail', { volume: 0.9 });
    showEndcard(failCard, (tl) => {
      if (REDUCED_MOTION) {
        tl.from('.full, .btn', { autoAlpha: 0, duration: 0.4, stagger: 0.04 });
        return;
      }
      tl.from('[data-el="bubble"]', { scale: 0.3, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.4)', transformOrigin: ORIGIN.bubble })
        .from('[data-el="poo"]', { y: -240, duration: 1, ease: 'bounce.out' }, 0.15)
        .from('[data-el="poo"]', { autoAlpha: 0, duration: 0.2 }, 0.15)
        .from('.bac', { scale: 0, rotation: -40, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(2.5)', transformOrigin: '50% 50%' }, 0.5)
        .from('[data-el="hl"]', { y: 30, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, 0.7)
        .from('.btn', { scale: 0.5, autoAlpha: 0, duration: 0.55, stagger: 0.12, ease: 'back.out(2.2)' }, 1.0)
        .add(() => {
          // calm idle loops: bacteria float, CTA breathes
          $$('.bac', failCard).forEach((el, i) => {
            gsap.to(el, { y: i % 2 ? 5 : -5, rotation: i % 2 ? 3 : -3, duration: rand(1.3, 1.9), ease: 'sine.inOut', yoyo: true, repeat: -1 });
          });
          ctaPulse($('[data-el="cta"]', failCard));
        });
    });
  }

  function showWin() {
    sound.play('cheer', { volume: 0.9 });
    sound.play('applause', { volume: 0.6 });
    showEndcard(winCard, (tl) => {
      if (REDUCED_MOTION) {
        tl.from('.full, .btn', { autoAlpha: 0, duration: 0.4, stagger: 0.04 });
        return;
      }
      tl.from('[data-el="bubble"]', { scale: 0.3, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.4)', transformOrigin: ORIGIN.bubble })
        .from('[data-el="konfetti"]', { scale: 0.15, rotation: -12, autoAlpha: 0, duration: 1.1, ease: 'expo.out', transformOrigin: ORIGIN.konfetti }, 0.2)
        .add(burstConfetti, 0.25)
        .from('[data-el="poo"]', { y: 200, scale: 0.6, duration: 0.9, ease: 'back.out(1.6)', transformOrigin: ORIGIN.happyPoo }, 0.35)
        .from('[data-el="poo"]', { autoAlpha: 0, duration: 0.2 }, 0.35)
        .from('[data-el="hl"]', { y: 30, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, 0.75)
        .from('.btn', { scale: 0.5, autoAlpha: 0, duration: 0.55, ease: 'back.out(2.2)' }, 1.05)
        .add(() => {
          // happy little hops
          gsap.to('[data-el="poo"]', {
            keyframes: [
              { y: -14, scaleY: 1.04, duration: 0.25, ease: 'power2.out' },
              { y: 0, scaleY: 1, duration: 0.3, ease: 'bounce.out' },
              { y: 0, duration: 0.9 },
            ],
            transformOrigin: ORIGIN.happyPoo,
            repeat: -1,
          });
          ctaPulse($('[data-el="cta"]', winCard));
        });
    });
  }

  function ctaPulse(el) {
    gsap.to(el, { scale: 1.05, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: 11 });
  }

  // Extra confetti particles flying out of the party hat (canvas, ~3 s, then stops)
  const CONFETTI_COLORS = ['#f9a08e', '#fde6d0', '#a8d8c0', '#8ec5e6', '#ffffff', '#f6d24a', '#e8857a'];
  function burstConfetti() {
    if (REDUCED_MOTION) return;
    confettiParticles = Array.from({ length: 90 }, () => {
      const a = rand(-0.5, 1.1); // radians, mostly towards bottom-right
      const v = rand(120, 380);
      return {
        x: 115,
        y: 165,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 80,
        rot: rand(0, Math.PI),
        vr: rand(-8, 8),
        w: rand(3, 6),
        h: rand(6, 11),
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        life: rand(2, 3.2),
      };
    });
  }

  function renderConfetti(dt) {
    const k = scale * dpr;
    confettiCtx.setTransform(k, 0, 0, k, 0, 0);
    confettiCtx.clearRect(0, 0, W, H);
    confettiParticles = confettiParticles.filter((p) => (p.life -= dt) > 0);
    for (const p of confettiParticles) {
      p.vx *= 0.985;
      p.vy = Math.min(p.vy + 260 * dt, 160);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.min(1, p.life * 1.5);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.scale(1, Math.cos(p.rot * 1.7)); // fake 3D flip
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
    }
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  function onTap(e) {
    if (e.target.closest('button')) return; // buttons handle their own clicks
    e.preventDefault();
    if (state === 'intro' || state === 'start') {
      startRun();
    } else if (state === 'play') {
      jump();
    }
  }

  ad.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
    if (e.repeat) return;
    if (state === 'intro' || state === 'start') startRun();
    else if (state === 'play') jump();
    e.preventDefault();
  });

  const clickout = () => window.open(getClickTag(), '_blank');
  $$('.cta').forEach((btn) => btn.addEventListener('click', clickout));
  $('#replay').addEventListener('click', replay);

  muteBtn.addEventListener('click', () => {
    const muted = !sound.muted;
    sound.unlock();
    sound.setMuted(muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Ton an' : 'Ton aus');
  });

  // ─── Visibility: pause game, animations and sound while not visible ────────
  let inViewport = true;
  function applyVisibility() {
    const visible = !document.hidden && inViewport;
    if (visible) {
      if (state === 'play') vy = Math.min(vy, 0); // don't resume mid-plunge
      gsap.globalTimeline.resume();
      sound.resume();
      startLoop();
    } else {
      stopLoop();
      gsap.globalTimeline.pause();
      sound.suspend();
    }
  }
  document.addEventListener('visibilitychange', applyVisibility);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting && entry.intersectionRatio > 0.5;
        applyVisibility();
      },
      { threshold: [0, 0.5, 1] }
    ).observe(ad);
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  // ?overlay=start|fail|win puts the design PNG on top at 50% opacity (alignment check)
  function addDesignOverlay(which) {
    const file = { fail: '02-fail-endcard', win: '03-win-endcard' }[which] || '01-start';
    const img = new Image();
    img.id = 'design-overlay';
    img.src = `design/${file}.png`;
    ad.appendChild(img);
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────
  async function boot() {
    sound.prefetch();
    fit();
    const entries = await Promise.all(Object.entries(IMAGES).map(async ([k, src]) => [k, await loadImage(src)]));
    images = Object.fromEntries(entries);
    // make sure the DOM layers are loaded too before the intro starts
    // (load events, not img.decode(): decode() can stall while the page isn't being rendered)
    const loaded = (img) =>
      new Promise((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    await Promise.all($$('img', ad).map(loaded));

    masks.player = buildMask(images.player);
    masks.border = buildMask(images.border);
    OBSTACLES.forEach((k) => (masks[k] = buildMask(images[k])));

    resetRun();
    if (params.has('overlay')) addDesignOverlay(params.get('overlay'));
    ad.classList.remove('is-loading');
    playIntro();
    startLoop();
    if (DEBUG) {
      // console helpers for QA
      window.gutRun = { showWin, showFail, replay, getState: () => ({ state, scroll, course, lastHit, playerY: view.playerY, vy }) };
    }
    if (AUTOPLAY) setTimeout(() => state === 'intro' || state === 'start' ? startRun() : null, 2000);
  }

  boot().catch((err) => console.error('[gut-run] failed to start', err));
})();
