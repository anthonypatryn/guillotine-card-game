# Guillotine — Digital (3-Player Hotseat)

A browser version of the 1998 Wizards of the Coast card game *Guillotine*.
React 19 + Vite. Pass-and-play for 3 players over 3 "days."

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (this repo)
```

> Note: when launched via the shared Claude preview config it runs on port **5174**
> (the `guillotine` launch entry), to avoid colliding with the mat-headz server on 5173.

## How a turn works

1. **Play one action card** (optional) — manipulates the line of nobles.
2. **Collect the front noble** (by the guillotine) — into your score pile.
3. **Draw an action card** — automatically at end of turn.

Day ends when the line is empty at the start of a turn (or via Robespierre /
Scarlet Pimpernel). After 3 days, highest score wins.

## Architecture

| File | Purpose |
|---|---|
| `src/data/cards.js` | All 40 noble + 50 action card definitions, `qty` (deck = 50 nobles / 60 actions), deck builders, color map, shuffle. |
| `src/utils/line.js` | Line move primitives. **index 0 = front (guillotine).** |
| `src/utils/scoring.js` | `computeScore(player)` — dynamic scoring (Count/Countess, Palace Guard count, Tragic Figure, Indifferent Public, support cards, etc.). |
| `src/utils/effects.js` | Action-card effect registry + targeting spec. `isImplemented()` gates M2 cards. |
| `src/hooks/useGame.js` | State machine: setup, turn loop, collection triggers, day rotation, game end. |
| `src/App.jsx` / `App.css` | UI: StartScreen, PassScreen, Board (line + guillotine + 3 panels), GameOver. |

Card art lives in `public/cards/{nobles,actions}/` (one image per unique card;
deck quantity is data in `cards.js`, not duplicate files).

## Status — Milestones 1 & 2 complete ✓ (all 50 action cards live)

Working: full 3-player turn loop, day rotation, end-game scoring, and **every
action card**. The adaptive targeting overlay handles all selection types —
line noble, player, noble-from-pile, card-from-hand, action-discard pick,
reveal-and-pick (Late Arrival), front-card pick (Twist of Fate), and reorder
(Opinionated Guards).

Effect families: line moves, move-to-front/end, rearrange/shuffle/reverse/Mass
Confusion/Escape, add/remove nobles, persistent scoring (Support ×3, Fountain of
Blood, Indifferent Public, Tough Crowd), economy (Double Feature, Political
Influence, Rain Delay, Rat Break, Information Exchange), and player attacks
(After You, Clerical Error, Infighting, Lack of Support, Missing Heads, Missed!,
Rush Job, Forced Break, Twist of Fate, Confusion in Line).

Rule enforcement: **Callous Guards** locks line-altering cards for everyone
(owner can discard it via the ✕ button); **Unpopular Judge** at the front blocks
all action play. Noble collection triggers all wired: Double Feature, Fast Noble,
Captain/General, Rival Executioner, Lady/Lord/Lady-in-Waiting, Foreign Support,
Robespierre, Master Spy, The Clown.

### Hotseat simplifications (where a card needs a hidden opponent's decision)

- **Infighting / Forced Break** — target discards 2 / 1 cards *at random* (rules
  say the player chooses; randomized to avoid mid-turn handoffs).
- **Clerical Error** — the target auto-takes your highest-value *other* noble.
- **The Clown / Innocent Victim** — Clown auto-goes to the next player; Innocent
  Victim's "discard an action" is not yet enforced.

## Polish (M3) ✓

- **Action log** — running feed of plays, collections, and day changes (follows
  cross-player effects).
- **Hover inspector** — hover any card (line / hand / pile / in-front) to see it
  enlarged with its full rules text in the side pane.
- **Score breakdown** — click a player's score to expand a per-card breakdown.
- **Rule-lock banners** — clear HUD notices for Unpopular Judge, Callous Guards,
  and Rush Job.
- Transitions/animations on cards, modals, log, and targeting highlights.

## Roadmap

- **Next** — make the remaining hotseat simplifications interactive (opponent
  choices with a quick handoff; Clown recipient; Innocent Victim discard).
- **Later** — AI opponents (hotseat foundation already in place).
