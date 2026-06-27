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
  const fullUrl = req.url;
  const prefix = '/api/vp/';
  const qIndex = fullUrl.indexOf('?');
  const pathPart = qIndex === -1 ? fullUrl : fullUrl.slice(0, qIndex);
  const queryPart = qIndex === -1 ? '' : fullUrl.slice(qIndex);

  if (!pathPart.startsWith(prefix)) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const rest = pathPart.slice(prefix.length);
  const firstSlash = rest.indexOf('/');
  if (firstSlash === -1) {
    res.status(400).json({ error: 'Missing asset path' });
    return;
  }

  const encodedDomain = rest.slice(0, firstSlash);
  const assetPath = rest.slice(firstSlash);
  const baseDomain = decodeURIComponent(encodedDomain);
  const url = `${baseDomain}${assetPath}${queryPart}`;
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
