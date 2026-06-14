const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { db, admin } = getFirebase();
    const { paymentId, transactionRef, secret } = req.body;
    if (secret !== process.env.WEBHOOK_SECRET) {
      res.status(403).json({ error: 'Invalid secret' });
      return;
    }
    const paymentRef = db.collection('payments').doc(paymentId);
    const payment = await paymentRef.get();
    if (!payment.exists) { res.status(404).json({ error: 'Payment not found' }); return; }
    const data = payment.data();
    if (data.status === 'verified') { res.json({ success: true, message: 'Already verified' }); return; }
    const duration = data.plan === 'yearly' ? 365 : 30;
    const end = new Date();
    end.setDate(end.getDate() + duration);
    await paymentRef.update({
      status: 'verified',
      transactionRef: transactionRef || data.transactionRef,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(data.userId).update({
      subscribed: true,
      subscriptionEnd: admin.firestore.Timestamp.fromDate(end),
      subscriptionPlan: data.plan
    });
    res.json({ success: true, message: 'Subscription activated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
