const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { paymentId } = req.body;
  if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 128) {
    res.status(400).json({ error: 'Invalid paymentId' });
    return;
  }

  try {
    const { db, FieldValue, Timestamp, auth } = getFirebase();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    const paymentRef = db.collection('payments').doc(paymentId);
    const doc = await paymentRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Payment not found' }); return; }

    const data = doc.data();
    if (data.userId !== decodedToken.uid) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    if (data.status === 'verified') { res.json({ success: true, message: 'Already verified' }); return; }

    // Require a transaction reference for manual/telebirr payments to prove user initiated payment
    const manualMethods = ['telebirr', 'manual', 'whatsapp', 'pending'];
    if (!data.transactionRef && (!data.method || manualMethods.includes(data.method))) {
      res.status(400).json({ error: 'Transaction reference required. Complete your payment first.' });
      return;
    }

    const duration = data.plan === 'yearly' ? 365 : 30;
    const end = new Date();
    end.setDate(end.getDate() + duration);

    await paymentRef.update({
      status: 'verified',
      verifiedAt: FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(data.userId).update({
      subscribed: true,
      subscriptionEnd: Timestamp.fromDate(end),
      subscriptionPlan: data.plan
    });

    res.json({ success: true, message: 'Subscription activated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
