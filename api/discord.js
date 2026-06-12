export const config = { api: { bodyParser: true } };

// Proxy Discord reads server-side using bot token
// Falls back gracefully if no token configured
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { channel_id, limit = 15 } = req.body || {};
  if (!channel_id) return res.status(400).json({ error: 'channel_id required' });

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return res.status(200).json({ messages: [], error: 'No bot token configured' });

  try {
    const r = await fetch(
      `https://discord.com/api/v10/channels/${channel_id}/messages?limit=${limit}`,
      { headers: { Authorization: `Bot ${token}`, 'User-Agent': 'FirstSignalOS/1.0' } }
    );
    if (!r.ok) return res.status(200).json({ messages: [], error: `Discord API ${r.status}` });
    const messages = await r.json();
    // Return simplified message objects
    const simplified = messages.map(m => ({
      id: m.id,
      content: m.content,
      author: m.author?.username || '?',
      timestamp: m.timestamp,
    }));
    res.status(200).json({ messages: simplified });
  } catch (err) {
    res.status(200).json({ messages: [], error: err.message });
  }
}
