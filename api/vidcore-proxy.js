const VIDCORE_ORIGIN = 'https://www.vidcore.org';

module.exports = async (req, res) => {
  const upstreamPath = req.query.target;
  if (!upstreamPath) {
    res.status(400).json({ error: 'Missing target parameter' });
    return;
  }

  const { target, ...queryParams } = req.query;
  const qs = new URLSearchParams(queryParams).toString();
  const upstreamUrl = `${VIDCORE_ORIGIN}/${upstreamPath}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': `${VIDCORE_ORIGIN}/`,
        'Accept': '*/*',
      }
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const body = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(body);
  } catch {
    res.status(502).end();
  }
};
