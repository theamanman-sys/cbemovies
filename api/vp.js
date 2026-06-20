const ALLOWED_PREFIXES = ['https://vidphantom.com', 'https://player.cinezo.live'];

module.exports = async (req, res) => {
  const { path } = req.query;
  if (!path) {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  const url = `https://vidphantom.com${path}`;
  if (!ALLOWED_PREFIXES.some(p => url.startsWith(p))) {
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
