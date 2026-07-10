const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { uid } = req.body;
  if (!uid || typeof uid !== 'string' || uid.length > 128) { res.status(400).json({ error: 'Invalid uid' }); return; }

  try {
    const { db, auth, FieldValue } = getFirebase();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const requesterUid = decodedToken.uid;

    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    const role = requesterDoc.exists ? requesterDoc.data().role : null;
    if (role !== 'admin' && role !== 'superadmin') {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    await db.collection('users').doc(uid).update({ verified: true });
    await db.collection('notifications').add({
      type: 'user_verified',
      userId: uid,
      verifiedBy: requesterUid,
      createdAt: FieldValue.serverTimestamp()
    });
    res.json({ success: true, message: 'User verified' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
