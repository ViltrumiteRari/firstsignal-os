export const config = { api: { bodyParser: false } };

const SYMBOLS = ['SPY', 'QQQ', 'VIX', 'TLT', 'IWM'];
const FMP_KEY = process.env.FMP_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  try {
    const result = {};

    if (FMP_KEY) {
      // Use FMP free tier — batch quote
      const syms = SYMBOLS.join(',');
      const r = await fetch(
        `https://financialmodelingprep.com/api/v3/quote-short/${syms}?apikey=${FMP_KEY}`
      );
      const data = await r.json();
      if (Array.isArray(data)) {
        data.forEach(q => {
          const chgPct = q.changesPercentage || 0;
          result[q.symbol] = {
            price: q.price?.toFixed(2) || '—',
            chg: (chgPct >= 0 ? '+' : '') + chgPct.toFixed(2) + '%',
            up: chgPct >= 0
          };
        });
      }
    } else {
      // Fallback: staggered individual fetches via Yahoo
      for (const sym of SYMBOLS) {
        try {
          const r = await fetch(
            `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
          );
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (meta) {
            const chg = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100);
            result[sym] = {
              price: meta.regularMarketPrice?.toFixed(2) || '—',
              chg: (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%',
              up: chg >= 0
            };
          }
        } catch { result[sym] = { price: '—', chg: '—', up: true }; }
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
