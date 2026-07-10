const TMDB_BASE = 'https://api.themoviedb.org/3';

const ALLOWED_PATHS = [
  'movie', 'tv', 'trending', 'search', 'discover', 'genre',
  'person', 'configuration', 'company'
];

function isPathAllowed(path) {
  const firstSeg = path.split('/')[0];
  return ALLOWED_PATHS.some(p => firstSeg === p);
}

module.exports = async (req, res) => {
  const token = process.env.TMDB_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'TMDB token not configured' });
    return;
  }

  const { path } = req.query;
  if (!path) {
    res.status(400).json({ error: 'Missing path parameter' });
    return;
  }

  const cleanPath = path.replace(/^\/+/, '').split('?')[0];
  if (!isPathAllowed(cleanPath)) {
    res.status(403).json({ error: 'Path not allowed' });
    return;
  }

  const qs = new URLSearchParams(req.query);
  qs.delete('path');
  // Merge any query params embedded in the path value (e.g. ?page=1 in path)
  const pathQuery = path.includes('?') ? new URLSearchParams(path.split('?')[1]) : new URLSearchParams();
  for (const [k, v] of pathQuery) { if (!qs.has(k)) qs.set(k, v); }
  qs.set('language', qs.get('language') || 'en-US');

  const url = `${TMDB_BASE}/${cleanPath}?${qs.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'TMDB proxy failed' });
  }
};
