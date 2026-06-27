const getFirebase = require('./_firebase');

async function verifyAdmin(req) {
  const { db, auth } = getFirebase();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await auth.verifyIdToken(idToken);
  const doc = await db.collection('users').doc(decodedToken.uid).get();
  if (!doc.exists) return null;
  const role = doc.data().role;
  if (role !== 'admin' && role !== 'superadmin') return null;
  return decodedToken;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const token = await verifyAdmin(req);
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { db, FieldValue } = getFirebase();
    if (req.method === 'GET') {
      const snap = await db.collection('notifications')
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ notifications });
    } else {
      const { type, userId, email, username } = req.body;
      if (!type) { res.status(400).json({ error: 'Missing type' }); return; }
      await db.collection('notifications').add({
        type, userId: userId || '', email: email || '', username: username || '',
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
