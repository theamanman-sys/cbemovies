const crypto = require('crypto');
const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { db, admin, auth: firebaseAuth } = getFirebase();
    const { accessToken } = req.body;

    if (!accessToken) {
      res.status(400).json({ error: 'accessToken is required' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    let userDoc = await db.collection('users').where('superappTokenHash', '==', tokenHash).limit(1).get();

    let uid;
    if (userDoc.empty) {
      const newUserRef = await db.collection('users').add({
        superappTokenHash: tokenHash,
        superappAccessToken: accessToken,
        role: 'user',
        verified: true,
        subscribed: false,
        subscriptionEnd: null,
        subscriptionPlan: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        watchlist: [],
        history: [],
        settings: { autoPlay: true, quality: 'auto', subtitles: true }
      });
      uid = newUserRef.id;
      await newUserRef.update({ uid });
    } else {
      uid = userDoc.docs[0].id;
      await db.collection('users').doc(uid).update({
        superappAccessToken: accessToken,
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const firebaseUid = `cbe_${uid}`;
    try {
      await firebaseAuth.getUser(firebaseUid);
    } catch {
      await firebaseAuth.createUser({
        uid: firebaseUid,
        displayName: 'CBE User',
        email: `cbe_${uid}@cbemovies.app`
      });
    }

    const customToken = await firebaseAuth.createCustomToken(firebaseUid);

    const userData = userDoc.empty
      ? { uid, role: 'user', verified: true, subscribed: false, subscriptionPlan: null, subscriptionEnd: null, settings: { autoPlay: true, quality: 'auto', subtitles: true }, watchlist: [], history: [] }
      : (() => { const d = userDoc.docs[0].data(); return { uid, ...d }; })();

    res.json({ success: true, customToken, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
