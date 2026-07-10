module.exports = async (req, res) => {
  const { path } = req.query;
  if (!path) {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  const url = new URL(path, 'https://brightpathsignals.com').href;
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { res.status(400).json({ error: 'Invalid path' }); return; }
  if (parsedUrl.hostname !== 'brightpathsignals.com' || parsedUrl.protocol !== 'https:') {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const allowedPrefixes = ['/uploads/', '/assets/'];
  if (!allowedPrefixes.some(p => parsedUrl.pathname.startsWith(p))) {
    res.status(403).json({ error: 'Path not allowed' }); return;
  }
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      }
    });
    if (response.status >= 300 && response.status < 400) {
      res.status(502).json({ error: 'Upstream redirected' });
      return;
    }
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
