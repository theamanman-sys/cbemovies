const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { uid } = req.query;
  if (!uid || typeof uid !== 'string' || uid.length > 128) { res.status(400).json({ error: 'Invalid uid' }); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' }); return;
  }
  const idToken = authHeader.split('Bearer ')[1];
  const { auth } = getFirebase();
  const decodedToken = await auth.verifyIdToken(idToken);
  if (decodedToken.uid !== uid) {
    const { db } = getFirebase();
    const requesterDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!requesterDoc.exists || (requesterDoc.data().role !== 'admin' && requesterDoc.data().role !== 'superadmin')) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
  }

  try {
    const { db } = getFirebase();
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) { res.json({ subscribed: false }); return; }
    const data = doc.data();
    if (!data.subscribed || !data.subscriptionEnd) { res.json({ subscribed: false }); return; }
    const end = data.subscriptionEnd.toDate ? data.subscriptionEnd.toDate() : new Date(data.subscriptionEnd);
    res.json({ subscribed: end > new Date(), expiresAt: end.toISOString(), plan: data.subscriptionPlan || null });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
