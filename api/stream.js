const getFirebase = require('./_firebase');
const ALLOWED_DOMAINS = ['brightpathsignals.com', 'streamdata.vaplayer.ru'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' }); return;
  }
  try {
    const { auth, db } = getFirebase();
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) { res.status(401).json({ error: 'User not found' }); return; }
    const userData = userDoc.data();
    if (userData.role !== 'admin' && userData.role !== 'superadmin') {
      if (!userData.subscribed || !userData.subscriptionEnd) {
        res.status(403).json({ error: 'Subscription required' }); return;
      }
      const end = userData.subscriptionEnd.toDate ? userData.subscriptionEnd.toDate() : new Date(userData.subscriptionEnd);
      if (end <= new Date()) { res.status(403).json({ error: 'Subscription expired' }); return; }
    }
  } catch (err) {
    res.status(401).json({ error: 'Invalid authorization' }); return;
  }

  const { url, imdb, type = 'movie', season, episode } = req.query;
  if (!url) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }
  const upstreamUrl = decodeURIComponent(url);
  let parsedUrl;
  try { parsedUrl = new URL(upstreamUrl); } catch { res.status(400).json({ error: 'Invalid upstream URL' }); return; }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') { res.status(403).json({ error: 'Protocol not allowed' }); return; }
  if (parsedUrl.port && !['80', '443', ''].includes(parsedUrl.port)) { res.status(403).json({ error: 'Port not allowed' }); return; }
  const hostname = parsedUrl.hostname.toLowerCase();
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f\u2000-\u200f\u2028-\u202f\u205f-\u206f\uff00-\uffef]/.test(hostname)) { res.status(403).json({ error: 'Invalid hostname' }); return; }
  if (!ALLOWED_DOMAINS.includes(hostname)) {
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
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).json(data);
      return;
    }
  } catch (err) { /* primary stream failed, try fallback */ }

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
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).json(data);
        return;
      }
    } catch (err) { /* fallback failed */ }
  }

  res.status(502).json({ error: 'Stream proxy failed' });
};
