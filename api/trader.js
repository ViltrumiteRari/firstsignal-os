export const config = { runtime: 'edge' };

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: CORS });
    }
    if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: CORS });
    }
    try {
          const body = await req.json();
          const { prompt } = body;
          if (!prompt) {
                  return new Response(JSON.stringify({ error: 'No prompt' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
          }
          const key = process.env.ANTHROPIC_API_KEY;
          if (!key) {
                  return new Response(JSON.stringify({ decision: 'WAIT', strike: null, reasoning: 'API key not configured on server', mindset: 'error', confidence: 0 }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
          }
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': key,
                            'anthropic-version': '2023-06-01'
                  },
                  body: JSON.stringify({
                            model: 'claude-sonnet-4-6',
                            max_tokens: 500,
                            messages: [{ role: 'user', content: prompt }]
                  }),
          });
          const data = await resp.json();
          if (!resp.ok) {
                  return new Response(JSON.stringify({ decision: 'WAIT', strike: null, reasoning: data.error?.message || 'Anthropic error', mindset: 'api error', confidence: 0 }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
          }
          const text = data.content?.find(b => b.type === 'text')?.text || '{}';
          let decision;
          try {
                  const clean = text.replace(/```json|```/g, '').trim();
                  const s = clean.indexOf('{');
                  const e = clean.lastIndexOf('}');
                  decision = JSON.parse(clean.slice(s, e + 1));
          } catch {
                  decision = { decision: 'WAIT', strike: null, reasoning: 'parse error', mindset: 'recalibrating', confidence: 0 };
          }
          return new Response(JSON.stringify(decision), {
                  status: 200,
                  headers: { ...CORS, 'Content-Type': 'application/json' }
          });
    } catch (err) {
          return new Response(JSON.stringify({
                  decision: 'WAIT', strike: null,
                  reasoning: err.message, mindset: 'error', confidence: 0
          }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
}
