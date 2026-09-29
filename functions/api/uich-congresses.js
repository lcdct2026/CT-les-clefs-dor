const UICH_HOME = 'https://www.lesclefsdor.org/';
const UICH_HISTORY = 'https://www.lesclefsdor.org/about/history/';

const FALLBACK = [
  { year: 2026, city: 'Sydney', country: 'Australia', edition: '70th', dates: '12–17 April 2026', link: UICH_HISTORY },
  { year: 2027, city: 'Bangkok', country: 'Thailand', edition: '71st', dates: '16–21 April 2027', link: 'https://congress.lesclefsdor.org/' },
  { year: 2028, city: 'Rio de Janeiro', country: 'Brazil', edition: '72nd', dates: '2–7 April 2028', link: UICH_HOME }
];

const HEADERS = {
  'User-Agent': 'Les Clefs d’Or Chinese Taipei congress feed/1.0',
  'Accept': 'text/html;q=0.9'
};

function decode(s) {
  return String(s || '')
    .replace(/&#8217;|&#x2019;/gi, '’').replace(/&#8211;|&#x2013;/gi, '–').replace(/&#8212;|&#x2014;/gi, '—')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#160;/g, ' ');
}

function stripTags(html) {
  return decode(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

async function getText(url) {
  const r = await fetch(url, { headers: HEADERS, cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.text();
}

function ordinal(n) {
  const num = Number(n);
  if (num % 100 >= 11 && num % 100 <= 13) return num + 'th';
  switch (num % 10) { case 1: return num + 'st'; case 2: return num + 'nd'; case 3: return num + 'rd'; default: return num + 'th'; }
}

function extractFromHome(text) {
  const out = [];
  const re = /([A-Z][A-Z .,&'’\-]+),\s*([A-Z][A-Z .,&'’\-]+)\s+(\d{1,3})(?:st|nd|rd|th)\s+UICH International Congress\s+(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const year = Number(m[7]);
    out.push({ year, city: m[1].trim().replace(/,$/, ''), country: m[2].trim(), edition: ordinal(m[3]), dates: `${m[4]}–${m[5]} ${m[6]} ${m[7]}`, link: year === 2027 ? 'https://congress.lesclefsdor.org/' : UICH_HOME });
  }
  return out;
}

function extractFromHistory(text) {
  const marker = 'International Congress Host Cities';
  const idx = text.indexOf(marker);
  if (idx < 0) return [];
  const part = text.slice(idx, idx + 5000);
  const out = [];
  const re = /\b(20\d{2})\s+([A-Z][A-Za-zÀ-ÿ ./'’&\-]+?)(?=\s+20\d{2}\b|$)/g;
  let m;
  while ((m = re.exec(part))) {
    const year = Number(m[1]);
    if (year < 2026) continue;
    const city = m[2].trim();
    if (!city || /International|Learn More|Headquarters/i.test(city)) continue;
    out.push({ year, city, country: '', edition: year === 2026 ? '70th' : '', dates: '', link: UICH_HISTORY });
  }
  return out;
}

function merge(found) {
  const byYear = new Map(FALLBACK.map(x => [x.year, { ...x }]));
  for (const x of found) {
    if (!x.year) continue;
    const current = byYear.get(x.year) || {};
    byYear.set(x.year, { ...current, ...x, country: x.country || current.country, edition: x.edition || current.edition, dates: x.dates || current.dates, link: x.link || current.link });
  }
  return [...byYear.values()].filter(x => x.year >= 2026).sort((a,b) => b.year - a.year).slice(0,3).sort((a,b) => a.year - b.year);
}

export async function onRequestGet() {
  try {
    const [homeHtml, historyHtml] = await Promise.all([getText(UICH_HOME), getText(UICH_HISTORY)]);
    const found = [...extractFromHome(stripTags(homeHtml)), ...extractFromHistory(stripTags(historyHtml))];
    return json({ source: 'uich', mode: 'official', items: merge(found) }, 200, 3600);
  } catch (_) {
    return json({ source: 'uich', mode: 'fallback', items: FALLBACK }, 200, 900);
  }
}

function json(data, status=200, ttl=3600) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=600, s-maxage=${ttl}` } });
}
