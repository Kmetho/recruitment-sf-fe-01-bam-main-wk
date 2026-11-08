# Questions I would have asked

I didn't have time to wait for answers, so each question lists the assumption I worked with.
All of them are easy to change if the answer is different.

## Variant B – Fireplace

1. **Top headline copy doesn't match the layout.**
   `assets/top/hl.png` reads "STARK BEI / HUSTENREIZ & / HALSSCHMERZEN.", while `design/layout.png` shows "NATÜRLICH STARK / BEI HUSTENREIZ & / HALSSCHMERZEN.". Which copy is approved?
   *Assumption:* the asset is the latest approved version, so I used it.

2. **Is there a separate product image?**
   Both products are baked into the background images, so the "product slides in" idea from the brief isn't possible without cutting them out (= editing the assets).
   *Assumption:* no cut-out. The product arrives with the background zoom instead.

3. **Which background is the reference: the per-part cuts or `bg-big.jpg`?**
   `layout.png` was built from the per-part `bg.jpg` files, but those don't line up at the seams: the rock is cut off between top and right, and the colours jump. In `bg-big.jpg` the right product is about 12 % larger than in the layout.
   *Assumption:* a continuous surface matters more, so I used `bg-big.jpg` and accept the small product size difference on the right.

4. **Gap between the parts.**
   `bg-big.jpg` is 1680 px wide = 320 + 1032 + 320 + 8, so I assume a 4 px gap on each side of the top banner. Is that the publisher's real spacing, or should the background be cut without gaps?

5. **Assets without transparency.**
   `box.png`, `cta.png`, `left/hl.png` and `right/hl.png` have an opaque black background. Is that intentional (meant for a `screen` blend) or an export mistake?
   *Assumption:* export mistake, handled in CSS without editing the files. Re-exported PNGs with alpha would be cleaner.

6. **Text panel opacity.**
   In `layout.png` a little moss texture shows through the blue panel. Is a specific opacity intended?
   *Assumption:* about 90 %.

7. **Clickout area.**
   Should the whole part be clickable, or only the CTA? Some publishers don't allow full-area clicks on skins.
   *Assumption:* the whole part.

## Variant A – Gut Run

8. **"tab to run" typo.**
   `gesture.png` says "tab to run"; the brief says "tap to run". Is there a corrected export?
   *Assumption:* used as delivered.

9. **Endcard headline size.**
   The `hl.png` text on both endcards is set about 3 % wider than in the design PNGs. Top, left and height match.
   *Assumption:* the asset is correct, rendered at exactly 50 %.

10. **Obstacles on the start screen.**
    The start design shows four obstacles already in the gut, slightly scaled (e.g. a bacterium at about 70 %). Are they decoration, or the first obstacles of the run? If they were real, the player would hit one within the first second.
    *Assumption:* decoration. They pop away when the run starts, and all 15 obstacles then come in from the right.

11. **What counts as "leaving the playfield"?**
    *Assumption:* touching the cloud border at the top or bottom ends the run (pixel-accurate), not only leaving the screen.

12. **Taller phones.**
    On screens taller than 9:16 the design would have to be letterboxed or cropped.
    *Assumption:* the stage grows in height instead. The logo bar stays at the top, the content is centred, and the gut wall is extended with its flat colour. Is that OK, or do you prefer letterboxing?

## Both

13. **GSAP from a CDN.**
    Does it count towards the 3 MB, and do your ad servers allow cdnjs, or should it be bundled?
    *Assumption:* CDN, not counted.

14. **Sound default.**
    Should sound start unmuted after the first tap (current behaviour), or start muted with the toggle inviting the user to turn it on?
