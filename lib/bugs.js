// Bug reports: anyone files one (numbered BUG-1, BUG-2…); the owner reads them
// with the PIN and marks them fixed. One JSON document holds them all.
// Storage: Upstash Redis over REST in production (KV_REST_API_URL / KV_REST_API_TOKEN,
// set by the Vercel Upstash integration); a local file (.data/bugs.json) in dev.
import fs from 'node:fs';
import path from 'node:path';

const KEY = 'guillotine:bugs', MAX = 300;
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const clip = (s, n) => String(s ?? '').replace(/[<>]/g, '').slice(0, n);

async function redis(cmd) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export function makeStore(localDir) {
  if (URL && TOKEN) {
    return {
      kind: 'redis',
      load: async () => { const v = await redis(['GET', KEY]); return v ? JSON.parse(v) : null; },
      save: async (doc) => { await redis(['SET', KEY, JSON.stringify(doc)]); },
      nextNo: () => redis(['INCR', `${KEY}:no`]),
    };
  }
  if (!localDir) throw new Error('Bug reports aren’t set up yet: connect the Upstash Redis database in Vercel.');
  const file = path.join(localDir, 'bugs.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
  return {
    kind: 'file',
    load: async () => read(),
    save: async (doc) => { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 1)); },
    nextNo: async () => ((read()?.bugs ?? []).reduce((m, b) => Math.max(m, b.no), 0) + 1),
  };
}

// method, body, pin, expectedPin → [status, json]
export async function handleBugs(store, method, body, pin, expectedPin) {
  const norm = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '').trim();
  expectedPin = norm(expectedPin);
  const owner = !!expectedPin && norm(pin) === expectedPin;
  const doc = (await store.load()) || { bugs: [] };

  if (method === 'GET') {
    if (!expectedPin) return [401, { error: 'No PIN is set on the server (BUG_PIN).' }];
    if (!owner) return [401, { error: 'Wrong PIN.' }];
    return [200, { bugs: doc.bugs }];
  }

  if (body?.action === 'bug') {
    const what = clip(body.what, 1500).trim();
    if (!what) return [400, { error: 'Say what went wrong.' }];
    const g = body.game && typeof body.game === 'object' ? body.game : null;
    const no = await store.nextNo();
    const b = {
      no, what, where: clip(body.where, 120), page: clip(body.page, 160), ua: clip(body.ua, 160),
      game: g && {
        day: Number(g.day) || 0, phase: clip(g.phase, 20),
        players: Array.isArray(g.players) ? g.players.slice(0, 4).map((p) => clip(p, 40)) : [],
        log: Array.isArray(g.log) ? g.log.slice(-12).map((l) => clip(l, 160)) : [],
      },
      at: Date.now(), status: 'open', fixedAt: 0, fixNote: '',
    };
    const fresh = (await store.load()) || { bugs: [] };
    fresh.bugs = [b, ...fresh.bugs].slice(0, MAX);
    await store.save(fresh);
    return [200, { no }];
  }

  if (!owner) return [401, { error: 'Wrong PIN.' }];
  const nos = (Array.isArray(body?.nos) ? body.nos : [body?.no]).map(Number).filter(Boolean);
  const hit = doc.bugs.filter((b) => nos.includes(b.no));
  if (!hit.length) return [400, { error: `No BUG-${nos[0] ?? '?'}.` }];
  if (body.action === 'fix') hit.forEach((b) => Object.assign(b, { status: 'fixed', fixedAt: Date.now(), fixNote: clip(body.note, 300) }));
  else if (body.action === 'reopen') hit.forEach((b) => Object.assign(b, { status: 'open', fixedAt: 0 }));
  else if (body.action === 'remove') doc.bugs = doc.bugs.filter((b) => !hit.includes(b));
  else return [400, { error: 'Unknown action.' }];
  await store.save(doc);
  return [200, { ok: true }];
}
