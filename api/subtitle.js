const AdmZip = require('adm-zip');

const YIFY_API = 'https://yifysubtitles.org/api/moviedetails';
const CACHE_TTL = 86400;

function srtToVtt(srt) {
  let vtt = 'WEBVTT\n\n';
  const blocks = srt.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;
    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;
    const timeLine = lines[timeLineIdx].replace(/,/g, '.');
    const text = lines.slice(timeLineIdx + 1).join('\n').trim();
    if (!text) continue;
    vtt += `${timeLine}\n${text}\n\n`;
  }
  return vtt;
}

async function fetchYifySubtitles(imdbId) {
  const url = `${YIFY_API}?imdb_id=${encodeURIComponent(imdbId)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.data?.subtitles) return null;
    return data.data.subtitles.map(s => ({
      lang: s.lang,
      code: (s.language_code || s.lang || '').toLowerCase().slice(0, 2),
      url: s.url,
    }));
  } catch { return null; }
}

const LANG_MAP = {
  en:'gb',ar:'sa',bs:'ba',id:'id',ja:'jp',ms:'my',pt:'pt',
  ro:'ro',th:'th',tr:'tr',vi:'vn',fr:'fr',de:'de',es:'es',
  it:'it',ru:'ru',ko:'kr',zh:'cn',hi:'in',bn:'bd',sw:'tz',
  am:'et',so:'so',om:'et',ti:'er',
};

async function fetchYtsSubsSubtitles(imdbId) {
  const pageUrl = `https://yts-subs.com/movie-imdb/${encodeURIComponent(imdbId)}`;
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const subs = [];
    const rows = html.match(/<tr[^>]+data-id[^>]*>[\s\S]*?<\/tr>/g) || [];
    for (const row of rows) {
      const langMatch = row.match(/flag-([a-z]{2})/);
      if (!langMatch) continue;
      const flagCode = langMatch[1];
      const langNameMatch = row.match(/<span class="sub-lang">([^<]+)<\/span>/);
      if (!langNameMatch) continue;
      const linkMatch = row.match(/<a href="(\/subtitles\/[^"]+)"/);
      if (!linkMatch) continue;
      const code = Object.keys(LANG_MAP).find(k => LANG_MAP[k] === flagCode) || flagCode;
      subs.push({ lang: langNameMatch[1], code, url: `https://yts-subs.com${linkMatch[1]}` });
    }
    return subs.length ? subs : null;
  } catch { return null; }
}

async function downloadYtsSubtitleZip(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dlMatch = html.match(/data-link="([A-Za-z0-9+/=]+)"/);
    if (!dlMatch) return null;
    const zipUrl = Buffer.from(dlMatch[1], 'base64').toString('utf8');
    const zipRes = await fetch(zipUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!zipRes.ok) return null;
    const buffer = await zipRes.arrayBuffer();
    try {
      const zip = new AdmZip(Buffer.from(buffer));
      const entries = zip.getEntries();
      const srtEntry = entries.find(e => e.entryName.endsWith('.srt') || e.entryName.endsWith('.SRT'));
      if (!srtEntry) return null;
      return srtEntry.getData().toString('utf8');
    } catch { return null; }
  } catch { return null; }
}

async function downloadSubtitleZip(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    try {
      const zip = new AdmZip(Buffer.from(buffer));
      const entries = zip.getEntries();
      const srtEntry = entries.find(e => e.entryName.endsWith('.srt') || e.entryName.endsWith('.SRT'));
      if (!srtEntry) return null;
      return srtEntry.getData().toString('utf8');
    } catch { return null; }
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { imdb, lang, from = 'en', list } = req.query;

  if (!imdb) {
    res.status(400).json({ error: 'Missing imdb parameter' });
    return;
  }

  const cleanImdb = imdb.startsWith('tt') ? imdb : `tt${imdb}`;

  async function findSubs() {
    let s = await fetchYifySubtitles(cleanImdb);
    if (!s) s = await fetchYtsSubsSubtitles(cleanImdb);
    return s;
  }

  if (list === '1' || list === 'true') {
    const subs = await findSubs();
    if (!subs) {
      res.json({ success: true, subtitles: [] });
      return;
    }
    res.json({ success: true, subtitles: subs });
    return;
  }

  if (!lang) {
    res.status(400).json({ error: 'Missing lang parameter. Use list=1 to get available languages.' });
    return;
  }

  const subs = await findSubs();
  if (!subs || subs.length === 0) {
    res.status(404).json({ error: 'No subtitles found', imdb: cleanImdb });
    return;
  }

  const subLang = lang.toLowerCase().slice(0, 2);
  let sub = subs.find(s => s.code === subLang);
  if (!sub && subLang === 'en') {
    sub = subs.find(s => s.code === 'en' || s.lang.toLowerCase().includes('english'));
  }
  if (!sub) {
    sub = subs.find(s => s.code === 'en' || s.lang.toLowerCase().includes('english'));
  }
  if (!sub) {
    sub = subs[0];
  }

  let srtText;
  if (sub.url.includes('yts-subs.com')) {
    srtText = await downloadYtsSubtitleZip(sub.url);
  } else {
    srtText = await downloadSubtitleZip(sub.url);
  }
  if (!srtText) {
    res.status(502).json({ error: 'Failed to download subtitle file', sub: sub.url });
    return;
  }

  const vtt = srtToVtt(srtText);
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
  res.status(200).send(vtt);
};
