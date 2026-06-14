const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { db, admin } = getFirebase();
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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
