const crypto = require('crypto');
const stringify = require('json-stable-stringify');
const getFirebase = require('./_firebase');
const nacl = require('tweetnacl');
const { toByteArray } = require('base64-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { db, FieldValue, Timestamp } = getFirebase();
    const appSecret = process.env.CBE_APP_SECRET || '';
    const privateKeyB64 = process.env.CBE_PRIVATE_KEY || '';

    const body = req.body;
    if (!body || !body.transaction_reference || !body.merchant_reference || !body.status) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    const canonical = stringify({
      transaction_reference: body.transaction_reference,
      ft_number: body.ft_number || '',
      app_code: body.app_code || '',
      merchant_code: body.merchant_code || '',
      status: body.status,
      total_amount: body.total_amount || 0,
      currency: body.currency || 'ETB',
      merchant_reference: body.merchant_reference,
      transaction_date: body.transaction_date || ''
    });

    if (appSecret) {
      const hmac = crypto.createHmac('sha256', appSecret);
      hmac.update(canonical);
      const expectedHmac = hmac.digest('hex');
      const provided = body.confirm_payload || req.headers['x-confirm-payload'] || '';
      if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedHmac))) {
        res.status(401).json({ error: 'Invalid confirm_payload' });
        return;
      }
    }

    if (privateKeyB64 && body.sign) {
      const sk = toByteArray(privateKeyB64);
      const msgBytes = Buffer.from(canonical, 'utf-8');
      const sigBytes = toByteArray(body.sign);
      if (!nacl.sign.detached.verify(msgBytes, sigBytes, sk.subarray(32))) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const paymentsRef = db.collection('payments');
    const snapshot = await paymentsRef
      .where('merchantReference', '==', body.merchant_reference)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      res.status(404).json({ error: 'Payment not found for reference' });
      return;
    }

    const paymentDoc = snapshot.docs[0];
    const paymentData = paymentDoc.data();

    if (paymentData.status === 'verified') {
      res.json({ success: true, message: 'Already processed' });
      return;
    }

    if (body.status !== 'SUCCESS') {
      await paymentDoc.ref.update({
        status: 'failed',
        transactionRef: body.ft_number || '',
        failureReason: body.status,
        verifiedAt: FieldValue.serverTimestamp()
      });
      res.json({ success: true, message: 'Payment marked as failed' });
      return;
    }

    const duration = paymentData.plan === 'yearly' ? 365 : 30;
    const end = new Date();
    end.setDate(end.getDate() + duration);

    await paymentDoc.ref.update({
      status: 'verified',
      transactionRef: body.ft_number || '',
      method: 'cbe_superapp',
      verifiedAt: FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(paymentData.userId).update({
      subscribed: true,
      subscriptionEnd: Timestamp.fromDate(end),
      subscriptionPlan: paymentData.plan
    });

    res.json({ success: true, message: 'Subscription activated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
