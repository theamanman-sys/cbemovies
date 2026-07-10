const crypto = require('crypto');
const getFirebase = require('./_firebase');

const requestLog = new Map();

function rateLimit(key, maxAttempts = 10, windowMs = 60000) {
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

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!rateLimit(clientIp, 20, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const { db, FieldValue, auth: firebaseAuth } = getFirebase();
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string' || accessToken.length > 1024) {
      res.status(400).json({ error: 'Invalid accessToken' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    let userDoc = await db.collection('users').where('superappTokenHash', '==', tokenHash).limit(1).get();

    let uid;
    if (userDoc.empty) {
      const newUserRef = await db.collection('users').add({
        superappTokenHash: tokenHash,
        role: 'user',
        verified: true,
        subscribed: false,
        subscriptionEnd: null,
        subscriptionPlan: null,
        createdAt: FieldValue.serverTimestamp(),
        watchlist: [],
        history: [],
        settings: { autoPlay: true, quality: 'auto' }
      });
      uid = newUserRef.id;
      await newUserRef.update({ uid });
    } else {
      uid = userDoc.docs[0].id;
      await db.collection('users').doc(uid).update({
        lastLogin: FieldValue.serverTimestamp()
      });
    }

    const firebaseUid = `cbe_${uid}`;
    try {
      await firebaseAuth.getUser(firebaseUid);
    } catch {
      try {
        await firebaseAuth.createUser({
          uid: firebaseUid,
          displayName: 'CBE User',
          email: `cbe_${uid}@cbemovies.app`
        });
      } catch (createErr) {
        if (createErr.code !== 'auth/uid-already-exists') throw createErr;
      }
    }

    const customToken = await firebaseAuth.createCustomToken(firebaseUid);

    const userData = userDoc.empty
      ? { uid, role: 'user', verified: true, subscribed: false, subscriptionPlan: null, subscriptionEnd: null, settings: { autoPlay: true, quality: 'auto' }, watchlist: [], history: [] }
      : { uid, ...userDoc.docs[0].data() };

    res.json({ success: true, customToken, user: userData });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
