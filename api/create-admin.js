const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { uid, email, role, superAdminUid } = req.body;
  if (!uid || !superAdminUid) { res.status(400).json({ error: 'Missing required fields' }); return; }

  try {
    const { db } = getFirebase();
    const superDoc = await db.collection('users').doc(superAdminUid).get();
    if (superDoc.data().role !== 'superadmin') {
      res.status(403).json({ error: 'Only super admin can create admins' });
      return;
    }
    const targetRole = role === 'superadmin' ? 'superadmin' : 'admin';
    await db.collection('users').doc(uid).update({ role: targetRole, verified: true });
    await db.collection('admins').doc(uid).set({
      uid, email, role: targetRole,
      addedBy: superAdminUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, message: 'Admin created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
