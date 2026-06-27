const ALLOWED_DOMAINS = [
  'vixsrc.to',
  'vidcore.org',
  'player.cinezo.live',
  'vidsrc.pm',
  'vidphantom.com',
  'brightpathsignals.com',
  'streamdata.vaplayer.ru',
];

module.exports = async (req, res) => {
  const { slug } = req.query;
  if (!slug || slug.length < 2) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const qIndex = req.url.indexOf('?');
  const query = qIndex === -1 ? '' : req.url.slice(qIndex);
  const reconstructed = decodeURIComponent(slug.join('/'));
  let parsedUrl;
  try {
    parsedUrl = new URL(reconstructed + query);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  const url = parsedUrl.href;
  if (!ALLOWED_DOMAINS.some(d => url.includes(d))) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      }
    });
    if (!response.ok) {
      res.status(response.status).end();
      return;
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(Buffer.from(buffer));
  } catch {
    res.status(502).end();
  }
};
