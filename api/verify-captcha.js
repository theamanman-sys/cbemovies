const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

const requestLog = new Map();

function rateLimit(key, maxAttempts = 5, windowMs = 300000) {
  const now = Date.now();
  const entry = requestLog.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    requestLog.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!RECAPTCHA_SECRET) {
    res.status(500).json({ error: 'reCAPTCHA not configured' });
    return;
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!rateLimit(clientIp, 5, 300000)) {
    res.status(429).json({ error: 'Too many registration attempts. Try again later.' });
    return;
  }

  const { token } = req.body;
  if (!token || typeof token !== 'string' || token.length > 4096) {
    res.status(400).json({ error: 'Invalid captcha token' });
    return;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', RECAPTCHA_SECRET);
    params.append('response', token);
    params.append('remoteip', clientIp);

    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      body: params
    });
    const data = await verifyRes.json();

    if (data.success && data.score >= 0.5) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Captcha verification failed. Are you a robot?' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Captcha verification error' });
  }
};
