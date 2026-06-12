export const config = { api: { bodyParser: true } };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CACHE_HOURS = 6;

async function getCachedScan(ticker) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const since = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/scans?ticker=eq.${ticker}&created_at=gte.${since}&order=created_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await r.json();
    if (Array.isArray(data) && data.length && data[0].raw_output) return data[0];
    return null;
  } catch { return null; }
}

async function callAnthropic(body) {
  const useWebSearch = body._useWebSearch !== false;
  const model = body._model || 'claude-sonnet-4-6';
  delete body._useWebSearch;
  delete body._model;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01'
  };

  const payload = { ...body, model, max_tokens: body.max_tokens || 1200 };

  if (useWebSearch) {
    headers['anthropic-beta'] = 'web-search-2025-03-05';
    payload.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return r.text();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const body = { ...req.body };

    // SCAN CACHE CHECK — if ticker scan, check Supabase first
    const ticker = body._ticker;
    if (ticker && body._useCache !== false) {
      const cached = await getCachedScan(ticker.toUpperCase());
      if (cached) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          _cached: true,
          _cached_at: cached.created_at,
          content: [{ type: 'text', text: cached.raw_output }]
        });
      }
    }
    delete body._ticker;
    delete body._useCache;

    const text = await callAnthropic(body);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text || '{"error":"empty response"}');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
