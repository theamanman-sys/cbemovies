const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { uid } = req.query;
  if (!uid) { res.status(400).json({ error: 'Missing uid' }); return; }

  try {
    const { db } = getFirebase();
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) { res.json({ subscribed: false }); return; }
    const data = doc.data();
    if (!data.subscribed || !data.subscriptionEnd) { res.json({ subscribed: false }); return; }
    const end = data.subscriptionEnd.toDate ? data.subscriptionEnd.toDate() : new Date(data.subscriptionEnd);
    res.json({ subscribed: end > new Date(), expiresAt: end.toISOString(), plan: data.subscriptionPlan || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
