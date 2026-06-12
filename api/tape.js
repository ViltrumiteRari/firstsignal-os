export const config = { api: { bodyParser: false } };
const FMP = process.env.FMP_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  try {
    const syms = ['SPY','QQQ','VIX','TLT','IWM'];
    const results = await Promise.all(syms.map(async sym => {
      const r = await fetch(`https://financialmodelingprep.com/api/v3/quote/${sym}?apikey=${FMP}`);
      const d = await r.json();
      const q = Array.isArray(d) ? d[0] : d;
      const chg = q?.changesPercentage || 0;
      return [sym, { price: q?.price?.toFixed(2)||'—', chg:(chg>=0?'+':'')+chg.toFixed(2)+'%', up: chg>=0 }];
    }));
    res.status(200).json(Object.fromEntries(results));
  } catch(err) { res.status(500).json({ error: err.message }); }
}
