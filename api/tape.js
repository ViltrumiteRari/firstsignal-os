export const config = { api: { bodyParser: false } };

const SYMBOLS = ['SPY', 'QQQ', 'VIX', 'TLT', 'IWM', 'DXY'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  try {
    const symbols = SYMBOLS.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,regularMarketPrice,regularMarketChangePercent,regularMarketChange`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await r.json();
    const quotes = data?.quoteResponse?.result || [];

    const result = {};
    quotes.forEach(q => {
      const chg = q.regularMarketChangePercent || 0;
      result[q.symbol] = {
        price: q.regularMarketPrice?.toFixed(2) || '—',
        chg: (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%',
        up: chg >= 0
      };
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
