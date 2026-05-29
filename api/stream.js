const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhMzQyZWNhZjBjNzNmYzU1NmI1NDk3NzQwYmJmZmE5MiIsIm5iZiI6MTc3NTIyMDE5OS42MDA5OTk4LCJzdWIiOiI2OWNmYjVlNzY4YjcwYWNmYjgyZjc2MmQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.jxycsZVC7uLmewooOKm20BvZUZ5s5H4qPsalI3FBmok';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const STREAM_API = 'https://streamdata.vaplayer.ru/api.php';

async function tmdbFetch(path) {
  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}language=en-US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.url}`);
  return res.json();
}

async function lookupImdbId(tmdbId, type) {
  try {
    const endpoint = type === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
    const data = await tmdbFetch(endpoint);
    return data.imdb_id || null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { tmdb, imdb, type = 'movie', season, episode } = req.query;

  let imdbId = imdb || null;
  let usedFallback = false;

  if (!imdbId && tmdb) {
    imdbId = await lookupImdbId(tmdb, type);
    usedFallback = true;
  }

  if (!imdbId) {
    res.status(404).json({ error: 'Could not resolve IMDB ID' });
    return;
  }

  let apiUrl = `${STREAM_API}?imdb=${encodeURIComponent(imdbId)}&type=${type}`;
  if (type === 'tv' && season && episode) {
    apiUrl += `&season=${season}&episode=${episode}`;
  }

  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://brightpathsignals.com/',
      }
    });
    const data = await apiRes.json();

    if (data.status_code === 200 || data.status_code === '200') {
      res.json({
        success: true,
        title: data.data?.title || '',
        stream_url: data.data?.stream_urls?.[0] || null,
        stream_urls: data.data?.stream_urls || [],
        file_name: data.data?.file_name || '',
        backdrop: data.data?.backdrop || '',
        used_fallback: usedFallback,
      });
    } else {
      res.json({
        success: false,
        error: 'Stream not available',
        status_code: data.status_code,
        used_fallback: usedFallback,
      });
    }
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch stream data', detail: err.message });
  }
};
