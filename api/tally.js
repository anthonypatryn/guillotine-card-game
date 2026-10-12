import { makeTallyStore, handleTally } from '../lib/tally.js';

export default async function handler(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body
      : (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })();
    const [status, json] = await handleTally(makeTallyStore(), req.method, body);
    return res.status(status).json(json);
  } catch (e) {
    return res.status(200).json({ games: 0, wins: [], recent: [], error: String(e?.message || e) });
  }
}
