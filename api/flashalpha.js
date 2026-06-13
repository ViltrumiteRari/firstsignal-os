export const config = { api: { bodyParser: true } };

const FA_KEY = process.env.FLASHALPHA_API_KEY;
const FA_BASE = 'https://lab.flashalpha.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  if (!FA_KEY) return res.status(500).json({ error: 'FLASHALPHA_API_KEY not configured' });

  try {
    const url = `${FA_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${FA_KEY}`;
    const r = await fetch(url, {
      headers: { 'X-Api-Key': FA_KEY, 'Content-Type': 'application/json' }
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
