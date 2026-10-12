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
    // Drop any url on port 53 (often blocked / treated as DNS). Match the port
    // exactly — a naive ':53' substring also hits ':5349' (TURNS over TLS) and
    // would wrongly strip the whole relay, since Cloudflare bundles every url
    // (3478/5349/443/80) into one server object.
    const onPort53 = (u) => /:53(?=\D|$)/.test(String(u));
    const servers = (j?.iceServers || [])
      .map((s) => {
        if (!s.urls && s.url) return { ...s, urls: [].concat(s.url) };
        return s;
      })
      .map((s) => ({ ...s, urls: [].concat(s.urls || []).filter((u) => !onPort53(u)) }))
      .filter((s) => s.urls.length);
    return res.status(200).json({ iceServers: servers });
  } catch {
    return res.status(200).json({ iceServers: [] });
  }
}
