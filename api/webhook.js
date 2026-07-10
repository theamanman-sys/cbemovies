const crypto = require('crypto');
const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { db, FieldValue, Timestamp, auth } = getFirebase();
    const { paymentId, transactionRef } = req.body;
    if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 128) {
      res.status(400).json({ error: 'Invalid paymentId' });
      return;
    }

    const webhookSecret = process.env.WEBHOOK_SECRET;
    const signature = req.headers['x-webhook-signature'];
    let authenticated = false;

    if (webhookSecret && signature && typeof signature === 'string') {
      const expectedSig = crypto.createHmac('sha256', webhookSecret).update(paymentId).digest('hex');
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSig);
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        await auth.verifyIdToken(idToken);
        authenticated = true;
      }
    }

    if (!authenticated) {
      res.status(401).json({ error: 'Missing or invalid authentication' });
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
