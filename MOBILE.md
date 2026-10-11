# Mobile — audit & optimization

Guillotine is a **landscape** card game: a horizontal line of nobles leading to
the guillotine, with player panels alongside. This doc covers the mobile audit,
the strategy, and every change made so it plays well on phones and tablets.

## Strategy

1. **Landscape-first.** The board is inherently wide, so landscape is the
   intended phone orientation. Portrait phones get a full-screen *"turn your
   device sideways"* nudge rather than a cramped portrait board.
2. **Tap-first interaction.** Touch has no hover, which the desktop UI leaned on
   (preview, Play button, line-target highlights). On touch, a **tap pins** the
   big preview (with its Play/Cancel buttons); on desktop, hover still shows it
   transiently and a click plays immediately.

## Audit — what was wrong on touch

| Issue | Impact |
|---|---|
| Whole UI assumed **hover** (card preview, the Play button, "which nobles would this affect" highlight) | On touch none of it appeared; you couldn't read a card before committing. |
| Tapping a hand card **played it instantly** | Easy mis-taps on fanned, overlapping cards — no confirm step. |
| **Portrait** squeezed the line between the decks and the guillotine | Only ~1 noble visible; the core play area was unusable. |
| Tap targets / fanned hand | Small, overlapping — hard to hit the right card. |
| Centred preview sized for desktop | Overflowed short (landscape-phone) viewports. |

No horizontal **page** scroll was present (good) — only the line scrolls, on purpose.

## Changes

### Interaction model (`src/App.jsx`)
- `COARSE` = `matchMedia('(pointer: coarse)')`, evaluated once at load, decides
  touch vs mouse behaviour.
- The inspect controller now supports **pinned** previews. A pinned preview:
  - stays until dismissed (hover/mouse-leave can't close or replace it),
  - renders a **backdrop** (tap to close) and an explicit **Close/Cancel** button,
  - drives the line-target **highlight** via `ins.affected`.
- **Hand cards:** touch → tap opens the pinned preview with **Play**; mouse →
  hover previews, click plays directly. (`HandDock`)
- **Line nobles:** touch/click → if it's a valid target, pick it; otherwise open
  a pinned preview of the card. (`GuillotineLine`)
- `HoverCard` renders the backdrop + Close when `pinned`, and distinguishes
  mouse-leave (`onLeave`, transient only) from an explicit `onClose`.

### Orientation (`RotateHint` + CSS)
- A full-screen rotate prompt shows **only** on `(orientation: portrait) and
  (max-width: 860px) and (pointer: coarse)` — i.e. portrait touch phones. It
  never shows on desktop (even in a narrow window) or in landscape.

### Responsive layout / tap targets (`src/App.css`, `@media (pointer: coarse)`)
- Bigger hit areas: `min-height: 42px` on buttons, nav, difficulty/seat chips.
- Less hand **fan overlap** (`margin: 0 -6px`) and no hover-lift transform.
- Modals/sheets cap at `94vw`.
- Short viewports (`max-height: 540px`, landscape phones): the centred preview
  shrinks (`width: min(78vw,300px)`, `max-height: 94vh`, scrollable), its card
  image caps at `58vh`, and the top bar / logo compress.
- In landscape the board uses the existing single-column stack, giving the line
  the **full width** (~5+ nobles visible, the rest scroll).

### Performance
- Card `<img>`s use `loading="lazy"` + `decoding="async"`.
- The music player sets `src` **on demand** (never preloads all 6 tracks); SFX
  are a handful of small clips. Only visible card art is fetched.

## Testing matrix

| Viewport | Result |
|---|---|
| Portrait phone (375×812, touch) | Rotate nudge shown; game hidden. ✓ |
| Landscape phone (740×360, touch) | Line readable (~5 nobles + guillotine); **tap a noble** → pinned preview; **tap a hand card** → preview with Play → plays. ✓ |
| Desktop (mouse) | Hover preview + click-to-play unchanged; no rotate hint. ✓ |
| No horizontal page scroll at 375px. ✓ |

> Note when testing in the Chromium devtools/preview: touch emulation (and thus
> `pointer: coarse`) only turns on **below 768px wide**. Use e.g. 740×360 to test
> the landscape touch flow.

## Future / nice-to-haves

- Make **front cards** and **pile cards** tap-previewable too (currently
  hover-only; secondary).
- A proper **portrait** board layout (line wraps full-width) so portrait is
  playable, not just redirected.
- Add to home screen / **PWA** manifest + icons for a full-screen app feel.
- Optionally compress the card JPEGs / serve WebP to cut mobile data.
