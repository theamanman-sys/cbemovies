const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { db, FieldValue, Timestamp } = getFirebase();
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-Gbi7RbSHFgHJlzcdbY1diPpPr7e80uaw';
    const baseUrl = process.env.BASE_URL || 'https://cbemovies.vercel.app';

    if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await getFirebase().auth.verifyIdToken(idToken);

      const { uid, plan } = req.body;
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

      const txRef = 'CBE_' + uid.slice(0, 8) + '_' + Date.now();

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
        chapaTxRef: chapaData.data.tx_ref || '',
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
      let txRef;

      const ref = req.query.tx_ref || req.query.txRef;
      if (req.headers['x-chapa-signature']) {
        const body = req.body;
        txRef = body?.tx_ref || body?.txRef;
      }
      txRef = txRef || ref;

      if (!txRef) {
        res.status(400).json({ error: 'Missing tx_ref parameter' });
        return;
      }

      const verifyRes = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(txRef), {
        headers: { 'Authorization': 'Bearer ' + chapaSecretKey }
      });

      const verifyData = await verifyRes.json();

      if (verifyData.status === 'success') {
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

            await paymentSnap.ref.update({
              status: 'verified',
              verifiedAt: FieldValue.serverTimestamp()
            });

            await db.collection('users').doc(data.userId).update({
              subscribed: true,
              subscriptionEnd: Timestamp.fromDate(end),
              subscriptionPlan: data.plan
            });
          }
        }

        res.json({ success: true, verified: true, message: 'Payment verified successfully' });
      } else {
        res.json({ success: false, verified: false, message: verifyData.message || 'Payment not yet verified' });
      }
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
