# Guillotine — Digital

A browser version of the 1998 Wizards of the Coast card game *Guillotine* —
heavily French-themed (Parisian palette, fleurs-de-lis, red-carpet runner).
**React 19 + Vite**, plain CSS, no backend required to play.

Live: **https://guillotine-card-game.vercel.app** (auto-deploys from `main`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

> Under the shared Claude preview config it runs on port **5174** (the
> `guillotine` launch entry) so it doesn't collide with the mat-headz server.

Other scripts: `npm run build` (production build), `npm run preview`,
`node scripts/generate-art.mjs` (regenerate derived art — see *Art pipeline*).

## How to play

Win by collecting the most valuable **heads** (nobles) over **3 days**.

**Each turn, in order:**
1. **Play one action card** *(optional)* — rearranges the line, adds/removes
   nobles, or targets an opponent.
2. **Off with their head!** — click the **guillotine** to behead the front
   noble into your score pile. This is the explicit turn-ender (so you can
   study the board first); the blade drops on each behead.
3. **Draw** an action card (automatic).

A day ends when the line is empty; a fresh 12 nobles are dealt. After day 3 the
highest score wins. Scoring is dynamic — Count/Countess, Palace Guard (n²),
Tragic Figure, Indifferent Public, support cards, Fountain of Blood, Tough
Crowd, etc. (`src/utils/scoring.js`).

### Players & CPU

- **2–5 players**, any mix of humans (hotseat) and computers — set on the start
  screen.
- CPU opponents fight under **French-Resistance code-names** (Le Renard, La
  Chouette, …) at three nerve levels: **Recrue** (easy, hesitant), **Résistant**
  (medium), **Maquisard** (hard, ruthless) — `cpuChoose()` in `useGame.js`.
- **Online** — "Play Online" on the start screen: host a room (get a 5-letter
  code) or join by code / invite link (`/?join=CODE`). Peer-to-peer over WebRTC
  (PeerJS, host-authoritative — the host runs the engine and streams sanitized
  per-seat state; friends send actions for their own seat). No game server/DB.
  See `src/net/room.js` (`HostRoom`/`JoinClient`) and the `*Shell` components.

## Features

- **Real art** — faction baskets (recoloured to the card colours, embossed
  symbols, count in the handle), severed-head points silhouette, the artist's
  metallic fleurs-de-lis, the guillotine blade, and the logo wordmark.
- **Player cards** styled like the physical card mockup (gold border, name,
  hand-stack, gold head/points, 5-basket row).
- **Animations** — cards deal off the two draw piles into the line / hand; a
  slice + blood-splatter + blade-drop on each behead; a **clock-wipe day
  transition** (per-day colour + ghosted 45° fleur pattern) with a rooster crow;
  a bell toll at game over; play callouts; a wooden **notice-board endgame** with
  nailed parchment scores. All respect `prefers-reduced-motion` / the in-game
  reduce-motion toggle.
- **Helpful UI** — hovering a hand card highlights the line nobles it would
  affect; a big centred hover preview with a **Play** button; a shared
  turn-steps strip (Action · Collect · Draw).
- **Sound** — synthesised whoosh, slice/gore SFX, bell, rooster, and a French
  **music player** (prev/play/next, seek bar, volume) with 6 tracks.
- **Themes** — 9 colour palettes + independent heading/body font pickers
  (defaults: Carter One headings, Merriweather body) via the 🎨 sheet.

## Utility pages

| URL | What |
|---|---|
| `/?view=bugs` | Bug viewer (PIN-gated). The 🐞 button files reports to Upstash Redis (`guillotine:bugs`). PIN defaults to `1327` (`BUG_PIN` env on Vercel). |
| `/?view=art` | Art review gallery — every asset on dark & light. |
| `/?view=cardedit` | Drag-and-scale editor for the head/basket/hand number positions. Copy the values and paste them to bake into CSS. |

## Architecture

| File | Purpose |
|---|---|
| `src/data/cards.js` | 40 nobles + 50 actions, `qty` (deck = 50 nobles / 60 actions), deck builders, `COLOR_HEX`, card-back paths, shuffle. |
| `src/utils/line.js` | Line primitives. **index 0 = front (guillotine).** |
| `src/utils/scoring.js` | `computeScore(player)` — dynamic scoring. |
| `src/utils/effects.js` | Action-card effect registry + targeting spec (`getStep`, `applyResolved`, `canPlayCard`, `lineNobleCandidates`). |
| `src/hooks/useGame.js` | State machine: setup, turn loop, collection triggers, CPU AI, day rotation, undo, game end. Supports 2–5 players. |
| `src/App.jsx` | All UI components (board, player cards, guillotine, decks, hover preview, modals, music player, theme/help sheets, bug + art + card-edit pages). |
| `src/Effects.jsx` | Animation components (slice flier, blood, deal flier, day clock, score delta). |
| `src/sound.js` | SFX pools + synthesised whoosh; bell / rooster helpers. |
| `src/App.css`, `src/index.css` | Styles + Google-font imports. |

## Art pipeline

The artist supplies two source SVGs in `public/`:
`art-pieces.svg` (baskets, faction symbols, head, blade) and `art-game.svg`
(the three metallic fleurs-de-lis + the card-layout mockup). The derived,
cropped/recoloured assets in `public/art/` are generated by:

```bash
node scripts/generate-art.mjs
```

The in-use UI fleur is `public/art/fleur.svg` — a copy of the chosen finish
(currently silver: `cp public/art/fleur-real-silver.svg public/art/fleur.svg`).
Card art (the noble/action illustrations and card backs) lives in
`public/cards/`; deck quantity is data in `cards.js`, not duplicate files.

## Hotseat simplifications

Where a card needs a hidden opponent's secret choice, it's automated to avoid
mid-turn handoffs: **Infighting/Forced Break** discard at random,
**Clerical Error** auto-takes your highest *other* noble, **The Clown** goes to
the next player. CPU players only play targeting-free "safe" actions.

## Deploy

Push to `main` → Vercel auto-deploys. The bug API (`api/bugs.js`) needs
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, and `BUG_PIN` set in the Vercel
project's **Environment Variables**. For online play on strict networks / phone
data, set `CF_TURN_KEY_ID` + `CF_TURN_API_TOKEN` (Cloudflare TURN) so `api/turn.js`
can hand out relay credentials — without them online still works over direct P2P.
