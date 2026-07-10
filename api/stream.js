const ALLOWED_DOMAINS = ['brightpathsignals.com', 'streamdata.vaplayer.ru'];

module.exports = async (req, res) => {
  const { url, imdb, type = 'movie', season, episode } = req.query;
  if (!url) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }
  const upstreamUrl = decodeURIComponent(url);
  let parsedUrl;
  try { parsedUrl = new URL(upstreamUrl); } catch { res.status(400).json({ error: 'Invalid upstream URL' }); return; }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') { res.status(403).json({ error: 'Protocol not allowed' }); return; }
  if (parsedUrl.port && !['80', '443', ''].includes(parsedUrl.port)) { res.status(403).json({ error: 'Port not allowed' }); return; }
  const hostname = parsedUrl.hostname.toLowerCase();
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f\u2000-\u200f\u2028-\u202f\u205f-\u206f\uff00-\uffef]/.test(hostname)) { res.status(403).json({ error: 'Invalid hostname' }); return; }
  if (!ALLOWED_DOMAINS.includes(hostname)) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }
  let response;
  try {
    response = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://brightpathsignals.com/',
        'Accept': 'application/json, text/plain, */*',
      }
    });
    if (response.ok) {
      const data = await response.json();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).json(data);
      return;
    }
  } catch (err) { /* primary stream failed, try fallback */ }

  if (imdb) {
    const cleanImdb = imdb.startsWith('tt') ? imdb : `tt${imdb}`;
    let fallbackUrl = `https://streamdata.vaplayer.ru/api.php?imdb=${encodeURIComponent(cleanImdb)}&type=${type}`;
    if (type === 'tv' && season && episode) {
      fallbackUrl += `&season=${season}&episode=${episode}`;
    }
    try {
      const fbRes = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://brightpathsignals.com/' }
      });
      if (fbRes.ok) {
        const data = await fbRes.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).json(data);
        return;
      }
    } catch (err) { /* fallback failed */ }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(502).json({ error: 'Stream proxy failed' });
};
