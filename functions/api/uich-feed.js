const SOURCES = {
  international: {
    feeds: [
      'https://www.lesclefsdor.org/feed/',
      'https://www.lesclefsdor.org/news/feed/',
      'https://www.lesclefsdor.org/news_categories/key-news/feed/'
    ],
    api: [
      'https://www.lesclefsdor.org/wp-json/wp/v2/posts?per_page=8&orderby=date&order=desc'
    ],
    pages: ['https://www.lesclefsdor.org/news/'],
    match: () => true
  },
  travel: {
    feeds: [
      'https://www.lesclefsdor.org/travels/feed/',
      'https://www.lesclefsdor.org/travel-with-us/feed/',
      'https://www.lesclefsdor.org/travel_tags/your-key-to/feed/'
    ],
    api: [
      'https://www.lesclefsdor.org/wp-json/wp/v2/travels?per_page=8&orderby=date&order=desc',
      'https://www.lesclefsdor.org/wp-json/wp/v2/travel?per_page=8&orderby=date&order=desc'
    ],
    pages: ['https://www.lesclefsdor.org/travels/','https://www.lesclefsdor.org/travel-with-us/'],
    match: (x) => /your\s+key\s+to|travel/i.test(`${x.title} ${x.link}`)
  },
  awards: {
    feeds: [
      'https://www.lesclefsdor.org/about/awards/feed/',
      'https://www.lesclefsdor.org/news_categories/training-and-development/feed/',
      'https://www.lesclefsdor.org/news_categories/press/feed/',
      'https://www.lesclefsdor.org/feed/'
    ],
    api: [
      'https://www.lesclefsdor.org/wp-json/wp/v2/posts?search=award&per_page=8&orderby=date&order=desc',
      'https://www.lesclefsdor.org/wp-json/wp/v2/posts?search=training&per_page=8&orderby=date&order=desc',
      'https://www.lesclefsdor.org/wp-json/wp/v2/posts?search=development&per_page=8&orderby=date&order=desc'
    ],
    pages: ['https://www.lesclefsdor.org/about/awards/','https://www.lesclefsdor.org/news_categories/training-and-development/'],
    match: (x) => /award|training|development|education|professional/i.test(`${x.title} ${x.link}`)
  }
};

const HEADERS = {
  'User-Agent': 'Les Clefs d’Or Chinese Taipei website feed/1.0',
  'Accept': 'application/rss+xml, application/atom+xml, application/json, text/xml, text/html;q=0.9'
};

function stripTags(s) {
  return (s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function decode(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#8217;|&#x2019;/gi, '’').replace(/&#8220;|&#x201C;/gi, '“').replace(/&#8221;|&#x201D;/gi, '”')
    .replace(/&#8211;|&#x2013;/gi, '–').replace(/&#8212;|&#x2014;/gi, '—')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function textBetween(block, tags) {
  for (const tag of tags) {
    const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const m = block.match(re);
    if (m) return stripTags(decode(m[1]));
  }
  return '';
}
function linkFromItem(block) {
  let m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (m) return m[1].trim();
  m = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  return m ? stripTags(decode(m[1])) : '';
}
function parseFeed(xml) {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block => ({
    title: textBetween(block, ['title']),
    link: linkFromItem(block) || textBetween(block, ['link']),
    date: textBetween(block, ['pubDate','published','updated'])
  })).filter(x => x.title && x.link);
}
function parseWpJson(json) {
  if (!Array.isArray(json)) return [];
  return json.map(x => ({
    title: stripTags(decode(x?.title?.rendered || x?.title || '')),
    link: x?.link || '',
    date: x?.date || x?.modified || ''
  })).filter(x => x.title && x.link);
}
function parsePage(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const title = stripTags(decode(m[2]));
    if (!title || title.length < 15 || title.length > 150) continue;
    if (/Paris Head Office|Contact|View all Posts|Learn more|Read more|Menu|Search/i.test(title)) continue;
    let link; try { link = new URL(m[1], baseUrl).href; } catch { continue; }
    if (!link.startsWith('https://www.lesclefsdor.org/')) continue;
    if (seen.has(link)) continue;
    seen.add(link);
    out.push({ title, link, date: '' });
  }
  return out;
}
function uniqueAndFilter(items, match, limit=5) {
  const seen = new Set();
  return items.filter(item => {
    if (!item || !item.link || !item.title) return false;
    if (!match(item)) return false;
    if (seen.has(item.link)) return false;
    seen.add(item.link); return true;
  }).slice(0, limit);
}
function normalizeDate(value) {
  if (!value) return '';
  const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0,10);
}

export async function onRequestGet(context) {
  const source = new URL(context.request.url).searchParams.get('source');
  const config = SOURCES[source];
  if (!config) return json({source:null, items:[], error:'Unknown source'}, 400, 600);

  // 1) Try RSS/Atom first.
  for (const feedUrl of config.feeds) {
    try {
      const r = await fetch(feedUrl, { headers: HEADERS, cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = uniqueAndFilter(parseFeed(xml), config.match, 5).map(x => ({...x, date: normalizeDate(x.date)}));
      if (items.length) return json({source, mode:'rss', items, feed:feedUrl}, 200, 3600);
    } catch (_) {}
  }

  // 2) Fall back to the public WordPress API when a feed endpoint is unavailable.
  for (const apiUrl of config.api) {
    try {
      const r = await fetch(apiUrl, { headers: HEADERS, cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!r.ok) continue;
      const data = await r.json();
      const items = uniqueAndFilter(parseWpJson(data), config.match, 5).map(x => ({...x, date: normalizeDate(x.date)}));
      if (items.length) return json({source, mode:'wp-json', items, feed:apiUrl}, 200, 3600);
    } catch (_) {}
  }

  // 3) Final graceful fallback: scrape the official archive/list page for titles + links only.
  let fallback = [];
  for (const page of config.pages) {
    try {
      const r = await fetch(page, { headers: HEADERS, cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!r.ok) continue;
      const html = await r.text();
      fallback = uniqueAndFilter(parsePage(html, page), config.match, 5);
      if (fallback.length) break;
    } catch (_) {}
  }
  return json({source, mode:fallback.length ? 'official-page-fallback' : 'empty', items:fallback}, 200, fallback.length ? 3600 : 600);
}

function json(data, status=200, cacheSeconds=3600) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=600, s-maxage=${cacheSeconds}`
    }
  });
}
