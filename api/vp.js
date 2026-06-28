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
  const { target } = req.query;
  if (!target) {
    res.status(400).json({ error: 'Missing target' });
    return;
  }

  const firstSlash = target.indexOf('/');
  if (firstSlash === -1) {
    res.status(400).json({ error: 'Missing asset path' });
    return;
  }

  const hostname = target.slice(0, firstSlash);
  const assetPath = target.slice(firstSlash);

  // Pass through additional query params (used by VidCore API calls)
  const { target: _, ...extraParams } = req.query;
  const qs = new URLSearchParams(extraParams).toString();
  const url = `https://${hostname}${assetPath}${qs ? '?' + qs : ''}`;

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
