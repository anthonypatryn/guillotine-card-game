// Online rooms, peer-to-peer over WebRTC (PeerJS free broker — no server/DB of ours).
// The HOST runs the real game engine (useGame); friends connect by room code and are thin
// terminals: they render a sanitized snapshot and send back ACTIONS for their own seat.
// Pattern ported from the Long Shot game (host-authoritative).
//
// friend → host:  { t:'hello', name, clientId }   { t:'action', fn, args }
// host → friend:  { t:'lobby', code, seats, started, you }   { t:'state', G, you }   { t:'ended', reason }
// both: { t:'ping' } / { t:'pong' }, and { t:'part', id, i, n, s } for chunked big messages.

import Peer from 'peerjs';

const PREFIX = 'guillotine-';
const PING_MS = 3000, LOST_MS = 10000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes
const MAX_SEATS = 5;
// actions a remote seat is allowed to invoke on the host engine
const ALLOWED = new Set(['playCard', 'pick', 'collectAndEnd', 'cancelTarget', 'discardFront']);

export const randomCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const peerId = (code) => PREFIX + code.toLowerCase();

export function clientId() {
  try {
    let id = localStorage.getItem('guillotine-client-id');
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem('guillotine-client-id', id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 12); }
}

// optional TURN relay credentials (for friends behind strict NATs / phone data)
let ice = null;
export function loadIce() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (ice && Date.now() - ice.at < (ice.servers ? 12 * 3600e3 : 60e3)) return ice.ready;
  const cur = { servers: null, at: Date.now() };
  cur.ready = fetch('/api/turn').then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j?.iceServers?.length) cur.servers = j.iceServers; }).catch(() => {});
  ice = cur; return cur.ready;
}
loadIce();
const peerOptions = () => {
  loadIce();
  return ice?.servers
    ? { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...ice.servers] } }
    : { debug: 0 };
};

const ERRORS = {
  'peer-unavailable': 'No room with that code. Check it, and that the host still has the game open.',
  network: 'Lost the matchmaking connection. Check your internet and try again.',
  'browser-incompatible': 'This browser can’t do online play — try Chrome, Safari or Firefox.',
};
const errText = (e) => ERRORS[e?.type] || e?.message || String(e);

// PeerJS silently refuses messages ≥ ~16KB; a mid-game snapshot exceeds that, so chunk it.
const PART_CHARS = 5000;
let partNo = 0;
function sendMsg(conn, msg) {
  const str = JSON.stringify(msg);
  if (str.length <= PART_CHARS) { conn.send(msg); return; }
  const id = ++partNo, n = Math.ceil(str.length / PART_CHARS);
  for (let i = 0; i < n; i++) conn.send({ t: 'part', id, i, n, s: str.slice(i * PART_CHARS, (i + 1) * PART_CHARS) });
}

const cleanChat = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120);

class Emitter {
  constructor() { this.subs = new Set(); }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit() { this.subs.forEach((fn) => fn(this)); }
}

// one seat may see its own hand; everyone else's hand only as a count; decks as counts;
// another player's in-progress targeting is hidden.
export function sanitize(G, seat) {
  return {
    ...G,
    players: G.players.map((p, i) => (i === seat
      ? p : { ...p, hand: p.hand.map((c) => ({ uid: c.uid, hidden: true })) })),
    nobleDeck: Array(G.nobleDeck.length).fill(0),
    actionDeck: Array(G.actionDeck.length).fill(0),
    pending: G.current === seat ? G.pending : null,
    selectedIdx: G.current === seat ? G.selectedIdx : null,
    log: G.log.slice(-60),
  };
}

// ───────────────────────────── host ─────────────────────────────
export class HostRoom extends Emitter {
  constructor(hostName, resume = null) {
    super();
    this.status = 'connecting';
    this.error = '';
    this.seats = resume ? resume.seats.map((s) => ({ ...s, connected: s.kind !== 'remote' }))
      : [{ name: hostName || 'You', kind: 'host', connected: true }];
    this.started = !!resume;
    this.game = null;            // the live useGame object, kept fresh by the host component
    this.conns = new Map();      // clientId → conn
    this.chat = [];              // { name, text, at }
    this.wantCode = resume?.code ?? null;  // after a reload: keep trying for the same code
    this.codeTries = 0;
    this.open(this.wantCode ?? randomCode());
    this.beat = setInterval(() => {
      const now = Date.now();
      for (const c of [...this.conns.values()]) {
        if (now - (c.lastSeen ?? now) > LOST_MS) { this.onClose(c); try { c.close(); } catch { /* gone */ } continue; }
        try { if (c.open) c.send({ t: 'ping' }); } catch { /* closed */ }
      }
    }, PING_MS);
  }

  open(code) {
    this.code = code;
    this.peer?.destroy();
    const peer = new Peer(peerId(code), peerOptions());
    this.peer = peer;
    peer.on('open', () => { this.status = 'open'; this.emit(); });
    peer.on('connection', (conn) => this.attachConn(conn));
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') {
        // the old tab's code can take a few seconds to free after a reload
        if (this.wantCode && this.codeTries++ < 8) { setTimeout(() => this.open(this.wantCode), 2500); return; }
        this.wantCode = null;
        return this.open(randomCode());
      }
      if (e.type === 'peer-unavailable') return;
      this.error = errText(e); this.status = this.status === 'open' ? 'open' : 'error'; this.emit();
    });
  }

  attachConn(conn) {
    conn.on('data', (m) => this.onMessage(conn, m));
    conn.on('close', () => this.onClose(conn));
    conn.on('error', (e) => { if (e?.type !== 'message-too-big') this.onClose(conn); });
  }

  onMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    conn.lastSeen = Date.now();
    if (m.t === 'pong') return;
    if (m.t === 'hello') {
      const id = String(m.clientId || '').slice(0, 20);
      const name = (String(m.name || 'Friend').trim().slice(0, 14)) || 'Friend';
      conn.clientId = id;
      let seat = this.seats.findIndex((s) => s.kind === 'remote' && s.clientId === id);
      // returning from a different browser (new id, same name as a quiet seat): reclaim it
      if (seat < 0 && this.started) {
        const quiet = (s) => !s.connected || Date.now() - (this.conns.get(s.clientId)?.lastSeen ?? 0) > PING_MS * 2;
        seat = this.seats.findIndex((s) => s.kind === 'remote' && s.name.toLowerCase() === name.toLowerCase() && quiet(s));
        if (seat >= 0) { this.conns.get(this.seats[seat].clientId)?.close?.(); this.conns.delete(this.seats[seat].clientId); this.seats[seat].clientId = id; }
      }
      if (seat < 0) {
        if (this.started) { this.refuse(conn, 'That game already started.'); return; }
        if (this.seats.length >= MAX_SEATS) { this.refuse(conn, `That room is full (${MAX_SEATS} players).`); return; }
        this.seats.push({ name: this.uniqueName(name), kind: 'remote', clientId: id, connected: true });
        seat = this.seats.length - 1;
      } else {
        this.seats[seat].connected = true;
        if (this.seats[seat].cpu) { this.seats[seat].cpu = false; this.game?.setSeatCpu(seat, false); }  // they're back: hand the seat back
      }
      this.conns.get(id)?.close?.();
      this.conns.set(id, conn);
      this.broadcastLobby();
      if (this.started && this.game) this.sendState(conn, seat);
      this.emit();
      return;
    }
    if (m.t === 'chat') { const seat = this.seatOf(conn); if (seat >= 0) this.say(this.seats[seat].name, m.text); return; }
    if (m.t === 'action' && this.started && this.game) {
      const seat = this.seatOf(conn);
      if (seat < 0) return;
      if (!ALLOWED.has(m.fn)) return;
      if (this.game.G.current !== seat) return;                 // only on your turn
      try { this.game[m.fn]?.(...(Array.isArray(m.args) ? m.args : [])); } catch { /* ignore bad action */ }
    }
  }

  // chat: anyone in the room; the host echoes it to every friend
  say(name, text) {
    text = cleanChat(text); if (!text) return;
    this.chat = [...this.chat.slice(-39), { name, text, at: Date.now() }];
    for (const c of this.conns.values()) { try { if (c.open) c.send({ t: 'chat', name, text }); } catch { /* closed */ } }
    this.emit();
  }
  sayAs(text) { const h = this.seats.find((s) => s.kind === 'host'); this.say(h?.name || 'Host', text); }

  onClose(conn) {
    const seat = this.seatOf(conn);
    if (seat < 0 || this.conns.get(conn.clientId) !== conn) return;
    this.conns.delete(conn.clientId);
    this.seats[seat].connected = false;
    if (!this.started) this.seats.splice(seat, 1);               // left the lobby: free the seat
    else { this.seats[seat].cpu = true; this.game?.setSeatCpu(seat, true); }  // dropped mid-game: the computer finishes their turns
    this.broadcastLobby(); this.emit();
  }

  // what the host's tab saves so a reload can pick the game back up
  snapshot() { return { code: this.code, seats: this.seats.map(({ name, kind, level, clientId }) => ({ name, kind, level, clientId })) }; }

  refuse(conn, reason) {
    const send = () => { try { conn.send({ t: 'ended', reason }); } catch { /* gone */ } setTimeout(() => { try { conn.close(); } catch { /* gone */ } }, 300); };
    if (conn.open) send(); else conn.on('open', send);
  }

  uniqueName(name) {
    const taken = new Set(this.seats.map((s) => s.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let k = 2; ; k++) { const n = `${name.slice(0, 11)} ${k}`; if (!taken.has(n.toLowerCase())) return n; }
  }
  seatOf(conn) { return this.seats.findIndex((s) => s.kind === 'remote' && s.clientId === conn.clientId); }

  // lobby controls
  addComputer() { if (!this.started && this.seats.length < MAX_SEATS) { this.seats.push({ name: `CPU ${this.seats.length}`, kind: 'ai', level: 1, connected: true }); this.broadcastLobby(); this.emit(); } }
  removeSeat(i) {
    if (this.started || this.seats[i]?.kind === 'host') return;
    const s = this.seats[i];
    if (s.kind === 'remote') { const c = this.conns.get(s.clientId); this.conns.delete(s.clientId); if (c) this.refuse(c, 'The host removed you.'); }
    this.seats.splice(i, 1); this.broadcastLobby(); this.emit();
  }
  setLevel(i, level) { const s = this.seats[i]; if (!this.started && s?.kind === 'ai') { s.level = level; this.broadcastLobby(); this.emit(); } }

  lobbySeats() { return this.seats.map(({ name, kind, level, connected }) => ({ name, kind, level, connected })); }
  sendLobbyTo(c, you) { try { if (c?.open) sendMsg(c, { t: 'lobby', code: this.code, seats: this.lobbySeats(), started: this.started, you }); } catch { /* closed */ } }
  broadcastLobby() { this.seats.forEach((s, i) => { if (s.kind === 'remote') this.sendLobbyTo(this.conns.get(s.clientId), i); }); }

  // the host component calls this on every engine change to push the new state out
  pushState() {
    if (!this.game) return;
    this.seats.forEach((s, i) => { if (s.kind === 'remote') { const c = this.conns.get(s.clientId); if (c?.open) this.sendState(c, i); } });
  }
  sendState(conn, seat) { try { sendMsg(conn, { t: 'state', G: sanitize(this.game.G, seat), you: seat }); } catch { /* closed */ } }

  // host presses Start: returns the names/cpu/levels arrays for game.start(...)
  setupArgs() {
    const names = this.seats.map((s) => s.name);
    const cpu = this.seats.map((s) => s.kind === 'ai');
    const cpuLevel = this.seats.map((s) => (s.kind === 'ai' ? (s.level ?? 1) : 0));
    return [names, cpu, cpuLevel];
  }
  markStarted() { this.started = true; this.broadcastLobby(); this.emit(); }

  close() {
    clearInterval(this.beat);
    for (const c of this.conns.values()) { try { c.send({ t: 'ended', reason: 'The host closed the room.' }); } catch { /* gone */ } }
    setTimeout(() => this.peer?.destroy(), 300);
  }
}

// ───────────────────────────── friend ─────────────────────────────
export class JoinClient extends Emitter {
  constructor(code, name) {
    super();
    this.code = cleanCode(code);
    this.name = name;
    this.id = clientId();
    this.status = 'connecting'; // connecting → lobby | game | reconnecting | ended | error
    this.error = '';
    this.lobby = null;
    this.G = null;
    this.you = null;
    this.chat = [];
    this.retries = 0;
    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => this.connect());
    this.peer.on('disconnected', () => { if (!this.peer.destroyed) this.peer.reconnect(); });
    this.peer.on('error', (e) => {
      if (this.G && ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected', 'peer-unavailable'].includes(e.type)) {
        this.status = 'reconnecting'; this.emit(); return this.retry();
      }
      this.fail(errText(e));
    });
  }

  connect() {
    const conn = this.peer.connect(peerId(this.code), { reliable: true, serialization: 'json' });
    this.conn = conn;
    conn.on('open', () => { this.retries = 0; this.lastSeen = Date.now(); conn.send({ t: 'hello', name: this.name, clientId: this.id }); });
    conn.on('data', (m) => this.onMessage(m));
    conn.on('close', () => { if (this.conn === conn && !['ended', 'error'].includes(this.status)) { this.status = 'reconnecting'; this.emit(); this.retry(); } });
    clearInterval(this.beat);
    this.beat = setInterval(() => {
      if (this.conn !== conn || !conn.open || ['ended', 'error', 'reconnecting'].includes(this.status)) return;
      if (Date.now() - this.lastSeen > LOST_MS) { this.status = 'reconnecting'; this.emit(); try { conn.close(); } catch { /* gone */ } this.retry(); }
    }, PING_MS);
  }
  retry() {
    if (this.retries++ > 40) return this.fail('Lost the connection to the host.');
    if (this.peer.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch { /* retry below */ } }
    clearTimeout(this.retryT);
    this.retryT = setTimeout(() => { if (!this.peer.destroyed) this.connect(); }, 2000);
  }

  onMessage(m) {
    if (!m || typeof m !== 'object') return;
    this.lastSeen = Date.now();
    if (m.t === 'part') {
      if (this.parts?.id !== m.id) this.parts = { id: m.id, got: [] };
      this.parts.got[m.i] = m.s;
      if (this.parts.got.filter((x) => x != null).length === m.n) { const whole = this.parts.got.join(''); this.parts = null; try { this.onMessage(JSON.parse(whole)); } catch { /* next update fixes it */ } }
      return;
    }
    if (m.t === 'ping') { try { this.conn?.send({ t: 'pong' }); } catch { /* closed */ } return; }
    if (m.t === 'lobby') { this.lobby = m; this.you = m.you; if (!m.started) { this.G = null; this.status = 'lobby'; } else if (this.G) this.status = 'game'; }
    else if (m.t === 'state') { this.G = m.G; this.you = m.you; this.status = 'game'; }
    else if (m.t === 'chat') { this.chat = [...this.chat.slice(-39), { name: m.name, text: cleanChat(m.text), at: Date.now() }]; }
    else if (m.t === 'ended') { this.status = 'ended'; this.error = m.reason || 'The room closed.'; this.peer.destroy(); }
    this.emit();
  }

  // send an engine action for my seat
  action(fn, args) { try { this.conn?.send({ t: 'action', fn, args }); } catch { /* reconnecting */ } }
  say(text) { text = cleanChat(text); if (text) { try { this.conn?.send({ t: 'chat', text }); } catch { /* reconnecting */ } } }
  fail(msg) { this.status = 'error'; this.error = msg; this.emit(); }
  rejoin() { if (this.peer.destroyed) return; clearTimeout(this.retryT); this.retries = 0; this.status = 'reconnecting'; this.error = ''; this.emit(); if (this.peer.disconnected) this.peer.reconnect(); else this.connect(); }
  close() { clearTimeout(this.retryT); clearInterval(this.beat); this.status = 'ended'; this.peer?.destroy(); }
}
