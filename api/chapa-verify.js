const getFirebase = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { db, FieldValue, Timestamp } = getFirebase();
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-Gbi7RbSHFgHJlzcdbY1diPpPr7e80uaw';

    let txRef;

    if (req.method === 'POST') {
      const body = req.body;
      if (body.body) {
        const inner = typeof body.body === 'string' ? JSON.parse(body.body) : body.body;
        txRef = inner.tx_ref || inner.txRef;
      } else {
        txRef = body.tx_ref || body.txRef;
      }
      if (!txRef && body.data) {
        txRef = body.data.tx_ref || body.data.txRef;
      }
    } else {
      txRef = req.query.tx_ref || req.query.txRef;
    }

    if (!txRef) {
      res.status(400).json({ error: 'Missing tx_ref parameter' });
      return;
    }

    const verifyRes = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(txRef), {
      headers: { 'Authorization': 'Bearer ' + chapaSecretKey }
    });

    const verifyData = await verifyRes.json();

    let paymentSnap;
    if (verifyData.status === 'success') {
      const payments = await db.collection('payments')
        .where('txRef', '==', txRef)
        .limit(1)
        .get();

      if (!payments.empty) {
        paymentSnap = payments.docs[0];
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

      res.json({
        success: true,
        verified: true,
        message: 'Payment verified successfully'
      });
    } else {
      res.json({
        success: false,
        verified: false,
        message: verifyData.message || 'Payment not yet verified',
        chapaStatus: verifyData.status
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
