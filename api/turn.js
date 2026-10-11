// Hands out short-lived Cloudflare TURN relay credentials so online friends behind
// strict NATs / phone data can still reach the host. Degrades gracefully to [] (PeerJS
// defaults / direct P2P) when not configured. Set CF_TURN_KEY_ID + CF_TURN_API_TOKEN on Vercel.
export default async function handler(req, res) {
  try {
    const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
    if (!id || !token) return res.status(200).json({ iceServers: [] });
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    });
    const j = await r.json();
    const servers = (j?.iceServers || []).filter((s) => {
      const urls = [].concat(s.urls || s.url || []);
      return urls.length && !urls.some((u) => String(u).includes(':53'));
    });
    return res.status(200).json({ iceServers: servers });
  } catch {
    return res.status(200).json({ iceServers: [] });
  }
}
