const SOURCES = {
  international: {
    feedUrls: [
      'https://www.lesclefsdor.org/news/feed/',
      'https://www.lesclefsdor.org/feed/'
    ],
    pages: [
      'https://www.lesclefsdor.org/news/'
    ],
    include: (title) => /key updates|newsletter|key news|congress|education|training|press release|event/i.test(title),
    exclude: (title) => /hello world|about les clefs d’or$|about les clefs dor$/i.test(title),
    fallback: [
      {
        title: 'Your Les Clefs d’Or Key Updates – Second Quarter 2026',
        link: 'https://www.lesclefsdor.org/news/'
      },
      {
        title: 'Les Clefs d’Or Denmark (De Gyldne Nøgler) Newsletter – July 2026',
        link: 'https://www.lesclefsdor.org/news/'
      },
      {
        title: 'Les Clefs d’Or Macau Newsletter – Issue 12',
        link: 'https://www.lesclefsdor.org/news/'
      }
    ]
  },
  travel: {
    feedUrls: [
      'https://www.lesclefsdor.org/travel_categories/your-key-to/feed/',
      'https://www.lesclefsdor.org/travels/feed/'
    ],
    pages: [
      'https://www.lesclefsdor.org/travel_categories/your-key-to/'
    ],
    include: (title) => /your\s+key\s+to/i.test(title),
    exclude: (title) => /award nominee|2019|2020|2021|2022|2023|2024/i.test(title),
    fallback: [
      {
        title: 'Your Key To San Diego USA 2026',
        link: 'https://www.lesclefsdor.org/travels/'
      },
      {
        title: 'Your Key To London UK 2026',
        link: 'https://www.lesclefsdor.org/travels/'
      },
      {
        title: 'Your Key To Dubai UAE 2026',
        link: 'https://www.lesclefsdor.org/travels/'
      }
    ]
  },
  awards: {
    feedUrls: [
      'https://www.lesclefsdor.org/news_categories/training-and-development/feed/',
      'https://www.lesclefsdor.org/about/awards/feed/'
    ],
    pages: [
      'https://www.lesclefsdor.org/about/awards/',
      'https://www.lesclefsdor.org/news_categories/training-and-development/'
    ],
    include: (title) => /award|training|development|education|key updates/i.test(title),
    exclude: (title) => /hello world/i.test(title),
    fallback: [
      {
        title: '2026 Young Leaders Award – Unwana van der Werk',
        link: 'https://www.lesclefsdor.org/about/awards/'
      },
      {
        title: 'Your Les Clefs d’Or Key Updates – Second Quarter 2026',
        link: 'https://www.lesclefsdor.org/news_categories/training-and-development/'
      },
      {
        title: '2026 Young Leaders Award – Nominees',
        link: 'https://www.lesclefsdor.org/about/awards/'
      }
    ]
  }
};

const HEADERS = {
  'User-Agent': 'Les Clefs d’Or Chinese Taipei website feed/2.0',
  'Accept': 'application/rss+xml, application/atom+xml, text/xml, text/html;q=0.9'
};

function decode(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#8217;|&#x2019;/gi, '’').replace(/&#8220;|&#x201C;/gi, '“').replace(/&#8221;|&#x201D;/gi, '”')
    .replace(/&#8211;|&#x2013;/gi, '–').replace(/&#8212;|&#x2014;/gi, '—')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#160;/g, ' ');
}

function stripTags(s) {
  return decode((s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function textBetween(block, tags) {
  for (const tag of tags) {
    const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const m = block.match(re);
    if (m) return stripTags(m[1]);
  }
  return '';
}

function linkFromItem(block, baseUrl) {
  let m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (m) return absoluteUrl(m[1], baseUrl);
  m = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  return m ? absoluteUrl(stripTags(m[1]), baseUrl) : '';
}

function absoluteUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).href; } catch { return ''; }
}

function parseFeed(xml, baseUrl) {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block => ({
    title: textBetween(block, ['title']),
    link: linkFromItem(block, baseUrl),
    date: textBetween(block, ['pubDate','published','updated'])
  })).filter(x => x.title && x.link);
}

function parsePage(html, baseUrl, config) {
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = stripTags(m[2]);
    if (!title || title.length < 12 || title.length > 180) continue;
    if (!config.include(title) || config.exclude(title)) continue;
    const link = absoluteUrl(m[1], baseUrl);
    if (!link || !link.startsWith('https://www.lesclefsdor.org/')) continue;
    if (seen.has(link)) continue;
    seen.add(link);
    out.push({ title, link });
    if (out.length >= 6) break;
  }
  return out;
}

function unique(items, config, limit = 3) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const title = stripTags(item.title);
    if (!title || !item.link) continue;
    if (!config.include(title) || config.exclude(title)) continue;
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    out.push({ title, link: item.link });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: HEADERS,
    cf: { cacheTtl: 3600, cacheEverything: true }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.text();
}

export async function onRequestGet(context) {
  const source = new URL(context.request.url).searchParams.get('source');
  const config = SOURCES[source];
  if (!config) return json({ source: null, items: [], error: 'Unknown source' }, 400, 600);

  // Prefer a real RSS/Atom feed, but reject placeholder/sample content.
  for (const feedUrl of config.feedUrls) {
    try {
      const xml = await fetchText(feedUrl);
      const items = unique(parseFeed(xml, feedUrl), config, 3);
      if (items.length) return json({ source, mode: 'rss', items }, 200, 3600);
    } catch (_) {}
  }

  // Reliable fallback: read the current official UICH archive/category page.
  for (const pageUrl of config.pages) {
    try {
      const html = await fetchText(pageUrl);
      const items = parsePage(html, pageUrl, config).slice(0, 3);
      if (items.length) return json({ source, mode: 'official-page', items }, 200, 3600);
    } catch (_) {}
  }

  return json({ source, mode: 'fallback', items: config.fallback }, 200, 3600);
}

function json(data, status = 200, cacheSeconds = 3600) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=600, s-maxage=${cacheSeconds}`
    }
  });
}
