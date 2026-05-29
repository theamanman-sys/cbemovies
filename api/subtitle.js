const AdmZip = require('adm-zip');

const YIFY_API = 'https://yifysubtitles.org/api/moviedetails';
const MYMEMORY_API = 'https://api.mymemory.translated.net/get';
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

function parseSRT(text) {
  const entries = [];
  const blocks = text.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;
    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;
    const text = lines.slice(timeLineIdx + 1).join('\n').trim();
    if (!text) continue;
    const [start, end] = lines[timeLineIdx].split('-->').map(t => t.trim());
    entries.push({ start: parseTime(start), end: parseTime(end), text });
  }
  return entries;
}

function parseTime(t) {
  const parts = t.replace(',', '.').split(/[:.]/);
  if (parts.length >= 3) {
    return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]) + (+(parts[3] || 0)) / 1000;
  }
  return 0;
}

function formatVTTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

function entriesToVtt(entries) {
  let vtt = 'WEBVTT\n\n';
  for (const entry of entries) {
    if (!entry.text) continue;
    vtt += `${formatVTTTime(entry.start)} --> ${formatVTTTime(entry.end)}\n${entry.text}\n\n`;
  }
  return vtt;
}

async function fetchYifySubtitles(imdbId) {
  const url = `${YIFY_API}?imdb_id=${encodeURIComponent(imdbId)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.success || !data.data?.subtitles) return null;
  return data.data.subtitles.map(s => ({
    lang: s.lang,
    code: (s.language_code || s.lang || '').toLowerCase().slice(0, 2),
    url: s.url,
  }));
}

async function downloadSubtitleZip(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  try {
    const zip = new AdmZip(Buffer.from(buffer));
    const entries = zip.getEntries();
    const srtEntry = entries.find(e => e.entryName.endsWith('.srt') || e.entryName.endsWith('.SRT'));
    if (!srtEntry) return null;
    return srtEntry.getData().toString('utf8');
  } catch {
    return null;
  }
}

async function translateEntry(entry, from, to) {
  const text = entry.text.trim();
  if (!text) return { ...entry };
  const params = new URLSearchParams({ q: text.slice(0, 500), langpair: `${from}|${to}` });
  try {
    const res = await fetch(`${MYMEMORY_API}?${params}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return { ...entry, text: data.responseData.translatedText };
      }
    }
  } catch {}
  return { ...entry };
}

async function translateEntries(entries, from, to) {
  const concurrency = 5;
  const results = [];
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const translated = await Promise.all(batch.map(e => translateEntry(e, from, to)));
    results.push(...translated);
  }
  return results;
}

function getLanguageName(code) {
  const names = {
    am: 'Amharic', en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', bn: 'Bengali', sw: 'Swahili',
    ti: 'Tigrinya', om: 'Oromo', so: 'Somali',
  };
  return names[code] || code.toUpperCase();
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

  if (list === '1' || list === 'true') {
    const subs = await fetchYifySubtitles(cleanImdb);
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

  const subs = await fetchYifySubtitles(cleanImdb);
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

  let srtText = await downloadSubtitleZip(sub.url);
  if (!srtText) {
    res.status(502).json({ error: 'Failed to download subtitle file', sub: sub.url });
    return;
  }

  if (lang.toLowerCase().slice(0, 2) !== from.toLowerCase().slice(0, 2) && lang !== from) {
    const entries = parseSRT(srtText);
    const translated = await translateEntries(entries, from, lang.slice(0, 2));
    const vtt = entriesToVtt(translated);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
    res.status(200).send(vtt);
  } else {
    const vtt = srtToVtt(srtText);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
    res.status(200).send(vtt);
  }
};
