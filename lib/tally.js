// All-time "Hall of Fame": every finished game records its winner; we keep a
// win-count per name and the most recent champions. Public (no PIN) — inputs clipped.
// Storage: Upstash Redis in production, a local file in dev (same as bugs).
import fs from 'node:fs';
import path from 'node:path';

const KEY = 'guillotine:tally', MAX_RECENT = 30;
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const clip = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

async function redis(cmd) {
  const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}

export function makeTallyStore(localDir) {
  if (URL && TOKEN) {
    return {
      load: async () => { const v = await redis(['GET', KEY]); return v ? JSON.parse(v) : null; },
      save: async (doc) => { await redis(['SET', KEY, JSON.stringify(doc)]); },
    };
  }
  if (!localDir) return null;
  const file = path.join(localDir, 'tally.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
  return {
    load: async () => read(),
    save: async (doc) => { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 1)); },
  };
}

// method, body → [status, json]
export async function handleTally(store, method, body) {
  if (!store) return [200, { games: 0, wins: [], recent: [] }];
  const doc = (await store.load()) || { games: 0, wins: {}, recent: [] };
  if (method === 'GET') {
    const wins = Object.entries(doc.wins || {}).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 12);
    return [200, { games: doc.games || 0, wins, recent: (doc.recent || []).slice(0, 12) }];
  }
  if (body?.action === 'record') {
    const winner = clip(body.winner, 14) || 'Someone';
    const score = Math.max(0, Math.min(999, Number(body.score) || 0));
    const players = Math.max(2, Math.min(5, Number(body.players) || 2));
    const fresh = (await store.load()) || { games: 0, wins: {}, recent: [] };
    fresh.games = (fresh.games || 0) + 1;
    fresh.wins = fresh.wins || {};
    fresh.wins[winner] = (fresh.wins[winner] || 0) + 1;
    fresh.recent = [{ winner, score, players, at: Date.now() }, ...(fresh.recent || [])].slice(0, MAX_RECENT);
    await store.save(fresh);
    return [200, { ok: true }];
  }
  return [400, { error: 'Unknown action.' }];
}
