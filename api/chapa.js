const crypto = require('crypto');
const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  const baseUrl = process.env.BASE_URL || 'https://cbemovies.vercel.app';
  const allowedOrigins = [baseUrl];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { db, FieldValue, Timestamp } = getFirebase();
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
    if (!chapaSecretKey) { res.status(500).json({ error: 'Chapa secret key not configured' }); return; }
    const baseUrl = process.env.BASE_URL || 'https://cbemovies.vercel.app';

    if (req.method === 'POST') {
      const body = req.body || {};

      // Verify-payment flow (called from frontend after manual/telebirr payment)
      if (req.query.action === 'verify') {
        const { paymentId } = body;
        if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 128) {
          res.status(400).json({ error: 'Invalid paymentId' });
          return;
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({ error: 'Missing authorization' });
          return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await getFirebase().auth.verifyIdToken(idToken);

        const paymentRef = db.collection('payments').doc(paymentId);
        const doc = await paymentRef.get();
        if (!doc.exists) { res.status(404).json({ error: 'Payment not found' }); return; }

        const data = doc.data();
        if (data.userId !== decodedToken.uid) {
          res.status(403).json({ error: 'Unauthorized' });
          return;
        }
        if (data.status === 'verified') { res.json({ success: true, message: 'Already verified' }); return; }

        const manualMethods = ['telebirr', 'manual', 'whatsapp', 'pending'];
        if (!data.transactionRef && (!data.method || manualMethods.includes(data.method))) {
          res.status(400).json({ error: 'Transaction reference required. Complete your payment first.' });
          return;
        }

        const duration = data.plan === 'yearly' ? 365 : 30;
        const end = new Date();
        end.setDate(end.getDate() + duration);

        await paymentRef.update({ status: 'verified', verifiedAt: FieldValue.serverTimestamp() });
        await db.collection('users').doc(data.userId).update({
          subscribed: true,
          subscriptionEnd: Timestamp.fromDate(end),
          subscriptionPlan: data.plan
        });

        res.json({ success: true, message: 'Subscription activated' });
        return;
      }

      // Chapa webhook callback (sent by Chapa server to callback_url)
      const chapaSignature = req.headers['x-chapa-signature'];
      if (chapaSignature || (!body.uid && (body.tx_ref || body.data?.tx_ref))) {
        const txRef = body.tx_ref || body.data?.tx_ref;

        const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
        if (webhookSecret) {
          if (!chapaSignature) {
            res.status(401).json({ error: 'Missing webhook signature' });
            return;
          }
          const orderedBody = JSON.stringify(body, Object.keys(body).sort());
          const expectedSig = crypto.createHmac('sha256', webhookSecret).update(orderedBody).digest('hex');
          if (chapaSignature !== expectedSig) {
            res.status(401).json({ error: 'Invalid webhook signature' });
            return;
          }
        }

        const verifyRes = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(txRef), {
          headers: { 'Authorization': 'Bearer ' + chapaSecretKey }
        });
        const verifyData = await verifyRes.json();

        if (verifyData.status === 'success' && verifyData.data?.status === 'success') {
          const payments = await db.collection('payments')
            .where('txRef', '==', txRef)
            .limit(1)
            .get();

          if (!payments.empty) {
            const paymentSnap = payments.docs[0];
            const data = paymentSnap.data();
            if (data.status !== 'verified') {
              const duration = data.plan === 'yearly' ? 365 : 30;
              const end = new Date();
              end.setDate(end.getDate() + duration);
              await paymentSnap.ref.update({ status: 'verified', verifiedAt: FieldValue.serverTimestamp() });
              await db.collection('users').doc(data.userId).update({
                subscribed: true,
                subscriptionEnd: Timestamp.fromDate(end),
                subscriptionPlan: data.plan
              });
            }
          } else {
            res.status(404).json({ error: 'Payment record not found' });
            return;
          }
        }

        res.status(200).json({ success: true });
        return;
      }

      // Normal init from frontend (requires auth)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await getFirebase().auth.verifyIdToken(idToken);

      const { uid, plan } = body;
      if (decodedToken.uid !== uid) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const userData = userDoc.data();

      const plans = { monthly: 299, yearly: 2999 };
      const amount = plans[plan];
      if (!amount) {
        res.status(400).json({ error: 'Invalid plan: ' + plan });
        return;
      }

      const txRef = 'CBE_' + crypto.randomBytes(8).toString('hex');

      const chapaRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + chapaSecretKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency: 'ETB',
          email: userData.email || 'customer@cbemovies.et',
          first_name: userData.firstName || 'CBE',
          last_name: userData.lastName || 'Movies',
          tx_ref: txRef,
          callback_url: baseUrl + '/api/chapa',
          return_url: baseUrl + '/payment.html?chapa_ref=' + txRef,
          customization: {
            title: 'CBE Movies Subscription',
            description: plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan - ' + amount + ' ETB'
          }
        })
      });

      const chapaData = await chapaRes.json();

      if (chapaData.status !== 'success') {
        res.status(500).json({ error: 'Chapa initialization failed: ' + (chapaData.message || JSON.stringify(chapaData)) });
        return;
      }

      const paymentRef = await db.collection('payments').add({
        userId: uid,
        amount,
        plan,
        method: 'chapa',
        status: 'pending',
        txRef: txRef,
        chapaTxRef: (chapaData?.data?.tx_ref) || '',
        createdAt: FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        paymentId: paymentRef.id,
        checkoutUrl: chapaData.data.checkout_url,
        txRef: txRef
      });
      return;
    }

    if (req.method === 'GET') {
      const txRef = req.query.tx_ref || req.query.txRef;

      if (!txRef) {
        res.status(400).json({ error: 'Missing tx_ref parameter' });
        return;
      }

      const payments = await db.collection('payments')
        .where('txRef', '==', txRef)
        .limit(1)
        .get();

      let localStatus = 'not_found';
      if (!payments.empty) {
        localStatus = payments.docs[0].data().status;
      }

      if (localStatus === 'verified') {
        res.json({ success: true, verified: true, localStatus, message: 'Payment already verified' });
        return;
      }

      const verifyRes = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(txRef), {
        headers: { 'Authorization': 'Bearer ' + chapaSecretKey }
      });

      const verifyData = await verifyRes.json();
      res.json({ chapaStatus: verifyData.status, localStatus });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
