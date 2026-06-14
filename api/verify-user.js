const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { uid, adminUid } = req.body;
  if (!uid) { res.status(400).json({ error: 'Missing uid' }); return; }

  try {
    const { db, admin } = getFirebase();
    const adminDoc = await db.collection('users').doc(adminUid || 'none').get();
    const role = adminDoc.exists ? adminDoc.data().role : null;
    if (role !== 'admin' && role !== 'superadmin') {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    await db.collection('users').doc(uid).update({ verified: true });
    res.json({ success: true, message: 'User verified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
