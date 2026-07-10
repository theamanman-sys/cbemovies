const ALLOWED_DOMAINS = [
  'vixsrc.to',
  'vidcore.org',
  'player.cinezo.live',
  'vidsrc.pm',
  'vidphantom.com',
  'brightpathsignals.com',
  'streamdata.vaplayer.ru',
  'yapgrid.com',
  'apiplayer.ru',
];

module.exports = async (req, res) => {
  const { target } = req.query;
  if (!target) {
    res.status(400).json({ error: 'Missing target' });
    return;
  }

  const extraParams = { ...req.query };
  delete extraParams.target;
  const qs = new URLSearchParams(extraParams).toString();
  const url = `https://${target}${qs ? '?' + qs : ''}`;

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { res.status(400).json({ error: 'Invalid target URL' }); return; }
  if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }
  if (parsedUrl.port && !['80', '443', ''].includes(parsedUrl.port)) {
    res.status(403).json({ error: 'Port not allowed' });
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
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
};
