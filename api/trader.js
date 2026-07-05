export const config = { runtime: 'edge' };

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

const TRADER_SCHEMA = {
    type: 'object',
    properties: {
        decision: { type: 'string', enum: ['WAIT', 'WAITING', 'BUY_CALL', 'BUY_PUT', 'SELL', 'HOLD'] },
        reasoning: { type: 'string', description: 'One sentence.' },
        mindset: { type: 'string', description: 'Signal you watch most.' },
        journal_entry: { type: 'string', description: 'One sentence updating session narrative, or empty string if nothing material changed.' },
        edge_state: { type: 'string', enum: ['NO_EDGE', 'CONDITIONS_FORMING', 'ENTRY_READY', 'IN_TRADE', 'EXITING'] },
        confidence_trend: { type: 'string', enum: ['BUILDING', 'STABLE', 'DECAYING', 'UNCLEAR'] },
        trade_confidence: { type: 'number', minimum: 0, maximum: 100 },
        invalidation_spot: { type: ['number', 'null'] },
        target_spot: { type: ['number', 'null'] },
        max_loss_pct: { type: ['number', 'null'] },
        memory_used: { type: 'string', description: 'Session or historical memory used.' },
        current_thesis: { type: 'string', description: 'One phrase.' },
        expected_next_path: { type: 'string', description: 'What should happen next.' },
        new_evidence: { type: 'string', description: 'What changed since prior decision.' },
        prior_trade_effect: { type: 'string', description: 'How previous entries/exits affect this decision.' },
        reevaluate_after_ticks: { type: 'integer', minimum: 1, maximum: 10 },
    },
    required: [
        'decision', 'reasoning', 'mindset', 'journal_entry', 'edge_state',
        'confidence_trend', 'trade_confidence', 'invalidation_spot', 'target_spot',
        'max_loss_pct', 'memory_used', 'current_thesis', 'expected_next_path',
        'new_evidence', 'prior_trade_effect', 'reevaluate_after_ticks',
    ],
};

function fail(status, message, detail) {
    console.error('TRADER_ROUTE_FAILURE', message, detail ? JSON.stringify(detail).slice(0, 800) : '');
    return new Response(JSON.stringify({ error: 'TRADER_ROUTE_FAILURE', message }), {
        status,
        headers: JSON_HEADERS,
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
    }
    try {
        const body = await req.json();
        const { prompt, temperature } = body || {};
        if (!prompt || typeof prompt !== 'string') {
            return fail(400, 'Missing prompt');
        }
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) {
            return fail(500, 'ANTHROPIC_API_KEY not configured on server');
        }

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                temperature: typeof temperature === 'number' ? temperature : 0.2,
                system: 'You are the continuous-session SPY 0DTE trader described in the user prompt. Always respond by calling the trader_decision tool with a complete, schema-valid decision object. Never respond with plain text.',
                messages: [{ role: 'user', content: prompt }],
                tools: [{
                    name: 'trader_decision',
                    description: 'Submit the structured trading decision for this tick.',
                    input_schema: TRADER_SCHEMA,
                }],
                tool_choice: { type: 'tool', name: 'trader_decision' },
            }),
        });

        const data = await resp.json();
        if (!resp.ok) {
            return fail(502, data?.error?.message || `Anthropic HTTP ${resp.status}`, data);
        }
        if (data.stop_reason === 'max_tokens') {
            return fail(502, 'Model output truncated at max_tokens');
        }

        const toolBlock = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'trader_decision');
        if (!toolBlock || typeof toolBlock.input !== 'object' || toolBlock.input === null) {
            return fail(502, 'No trader_decision tool_use block in model response', data.content);
        }

        return new Response(JSON.stringify(toolBlock.input), {
            status: 200,
            headers: JSON_HEADERS,
        });
    } catch (err) {
        return fail(500, err?.message || 'Unknown trader-route failure');
    }
}
