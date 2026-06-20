const ALLOWED_DOMAINS = ['brightpathsignals.com', 'streamdata.vaplayer.ru'];

module.exports = async (req, res) => {
  const { url, imdb, type = 'movie', season, episode } = req.query;
  if (!url) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }
  const upstreamUrl = decodeURIComponent(url);
  if (!ALLOWED_DOMAINS.some(d => upstreamUrl.includes(d))) {
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
  } catch {}

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
    } catch {}
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(502).json({ error: 'Stream proxy failed' });
};
