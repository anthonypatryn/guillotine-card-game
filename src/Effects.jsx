import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { NOBLE_BY_ID, COLOR_HEX, nobleImg } from './data/cards';
import { playRooster } from './sound';

let _reduce = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;
export function setReduce(v) { _reduce = !!v; }
export function isReduced() { return _reduce; }

// deterministic pseudo-random in [0,1) from an integer — so a card's slice
// angle is the same in flight and in the score pile, and stable across renders.
function rng(seed) { const x = Math.sin((seed + 1) * 999.73) * 10000; return x - Math.floor(x); }

export function sliceParams(uid) {
  return {
    tilt: (rng(uid) * 2 - 1) * 24,      // cut tilt, % of card height (varies the angle)
    rot:  (rng(uid + 7) * 2 - 1) * 7,   // jaunty rotation in the pile (deg)
    gap:  2 + rng(uid + 13) * 3,        // half-separation in the pile (px)
  };
}

// clip-path polygons for the two halves of a horizontal-ish cut.
function clips(tilt) {
  const top = 50 - tilt, bot = 50 + tilt;
  return {
    top: `polygon(0 0, 100% 0, 100% ${top}%, 0 ${bot}%)`,
    bottom: `polygon(0 ${bot}%, 100% ${top}%, 100% 100%, 0 100%)`,
  };
}

const CARD_W = 124, CARD_H = 178;

// A beheaded noble: splits along a varied diagonal, the halves kick apart, then
// tumble into the score pile. Positions are viewport coords.
export function SliceFlier({ flier, onDone }) {
  const topRef = useRef(null), botRef = useRef(null), slashRef = useRef(null);
  const { from, to, defId, uid } = flier;
  const def = NOBLE_BY_ID[defId];
  const p = sliceParams(uid);
  const c = clips(p.tilt);
  const cutDeg = Math.atan2(-(2 * p.tilt / 100) * CARD_H, CARD_W) * 180 / Math.PI;

  useLayoutEffect(() => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const sx = 8 + rng(uid + 3) * 8, sy = 16 + rng(uid + 5) * 10;
    const dur = _reduce ? 1 : 1500;
    const opt = { duration: dur, easing: 'cubic-bezier(.35,.1,.25,1)', fill: 'forwards' };
    // 0–.14 = anticipation (the card presses down), .28 = the cut, then tumble to the pile.
    const aTop = topRef.current.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1, offset: 0 },
      { transform: 'translate(0,3px) scale(1.03)', opacity: 1, offset: .14 },
      { transform: `translate(${-sx}px,${-sy}px) rotate(${-4 - p.rot}deg)`, opacity: 1, offset: .3 },
      { transform: `translate(${dx}px,${dy}px) rotate(${p.rot * 2}deg) scale(.34)`, opacity: .2, offset: 1 },
    ], opt);
    botRef.current.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1, offset: 0 },
      { transform: 'translate(0,3px) scale(1.03)', opacity: 1, offset: .14 },
      { transform: `translate(${sx}px,${sy}px) rotate(${4 + p.rot}deg)`, opacity: 1, offset: .3 },
      { transform: `translate(${dx}px,${dy + 6}px) rotate(${-p.rot * 2}deg) scale(.34)`, opacity: .2, offset: 1 },
    ], opt);
    if (slashRef.current && !_reduce) {
      slashRef.current.animate([
        { transform: 'scaleX(0)', opacity: 0, offset: 0 },
        { transform: 'scaleX(0)', opacity: 0, offset: .18 },
        { transform: 'scaleX(1.1)', opacity: 1, offset: .3 },
        { transform: 'scaleX(1.1)', opacity: 0, offset: .46 },
        { opacity: 0, offset: 1 },
      ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
    }
    aTop.onfinish = onDone;
    return () => aTop.cancel();
  }, []);

  return (
    <div className="slice-flier" style={{ left: from.x - CARD_W / 2, top: from.y - CARD_H / 2 }}>
      <img ref={topRef} className="slice-half" src={nobleImg(def.id)} alt=""
        style={{ clipPath: c.top, borderColor: COLOR_HEX[def.color] }} />
      <img ref={botRef} className="slice-half" src={nobleImg(def.id)} alt=""
        style={{ clipPath: c.bottom, borderColor: COLOR_HEX[def.color] }} />
      <div className="slash-wrap" style={{ transform: `rotate(${cutDeg}deg)` }}>
        <div ref={slashRef} className="slash" />
      </div>
    </div>
  );
}

// A burst of blood on the "camera" — a real splatter PNG, varied each time.
const BLOOD = ['/blood/b1.png', '/blood/b2.png', '/blood/b3.png', '/blood/b4.png', '/blood/b5.png'];

export function BloodSplatter({ splat, onDone }) {
  const ref = useRef(null);
  const src = useMemo(() => BLOOD[Math.floor(rng(splat.key) * BLOOD.length)], [splat.key]);

  useLayoutEffect(() => {
    if (_reduce) { onDone(); return; }
    const a = ref.current.animate([
      { opacity: 0, transform: 'scale(.55)' },
      { opacity: .95, transform: 'scale(1.07)', offset: .1 },
      { opacity: .88, transform: 'scale(1)', offset: .5 },
      { opacity: 0, transform: 'scale(1.03)' },
    ], { duration: 1500, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = onDone;
    return () => a.cancel();
  }, []);

  const rot = (rng(splat.key + 1) * 2 - 1) * 180;
  return (
    <div className="blood-wrap" style={{ left: splat.x, top: splat.y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${splat.scale})` }}>
      <img ref={ref} className="blood-img" src={src} alt="" />
    </div>
  );
}

// A collected noble shown as two jaunty halves — but it's still one card.
export function SlicedThumb({ defId, uid, className = '', title, onClick, onMouseEnter, onMouseLeave }) {
  const def = NOBLE_BY_ID[defId];
  const p = sliceParams(uid);
  const c = clips(p.tilt);
  const border = COLOR_HEX[def.color];
  return (
    <span className={'sliced-thumb ' + className} title={title}
      onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ '--rot': p.rot + 'deg', '--gap': p.gap + 'px' }}>
      <img className="st-half top" src={nobleImg(def.id)} alt={def.name} style={{ clipPath: c.top, borderColor: border }} />
      <img className="st-half bot" src={nobleImg(def.id)} alt="" style={{ clipPath: c.bottom, borderColor: border }} />
    </span>
  );
}

// Floats a +N / −N off a number when it changes.
export function ScoreDelta({ value }) {
  const prev = useRef(value);
  const [d, setD] = useState(null);
  useEffect(() => {
    const diff = value - prev.current;
    prev.current = value;
    if (diff !== 0) setD({ diff, key: Date.now() });
  }, [value]);
  if (!d) return null;
  return <span key={d.key} className={'score-delta ' + (d.diff > 0 ? 'up' : 'down')}>
    {d.diff > 0 ? `+${d.diff}` : d.diff}
  </span>;
}

// A card flying off a draw pile to where it lands (line / hand). Cosmetic: a
// card-back that arcs from the deck to the destination and fades as it settles.
export function DealFlier({ deal, onDone }) {
  const ref = useRef(null);
  const { from, to, back, delay = 0 } = deal;
  useLayoutEffect(() => {
    if (_reduce) { onDone(); return; }
    const dx = to.x - from.x, dy = to.y - from.y;
    const a = ref.current.animate([
      { transform: 'translate(0,0) scale(.86) rotate(-6deg)', opacity: 0, offset: 0 },
      { opacity: 1, offset: .14 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 26}px) scale(1.02) rotate(3deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px,${dy}px) scale(.78) rotate(0)`, opacity: 0, offset: 1 },
    ], { duration: 820, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
    a.onfinish = onDone;
    return () => a.cancel();
  }, []);
  return <img ref={ref} className="deal-flier" src={back} alt=""
    style={{ left: from.x - 22, top: from.y - 31 }} />;
}

// A clock wipe to a solid panel showing the day (rooster crows at dawn), then
// the clock wipes back to reveal the board.
export function DayBanner({ day }) {
  useEffect(() => { if (!_reduce) playRooster(); }, [day]);
  return (
    <div className="day-clock" key={day} data-day={day} aria-hidden="true">
      <div className="dc-fleurs" />
      <div className="dc-face">
        <img className="dc-fleur" src="/art/fleur.svg" alt="" />
        <span className="dc-day">Day {day}</span>
        <span className="dc-sub">of 3</span>
        <img className="dc-fleur" src="/art/fleur.svg" alt="" />
      </div>
    </div>
  );
}
