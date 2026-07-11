const crypto = require('crypto');
const stringify = require('json-stable-stringify');
const getFirebase = require('./_firebase');
const nacl = require('tweetnacl');
const { toByteArray, fromByteArray } = require('base64-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { db, FieldValue, auth } = getFirebase();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    const { uid, plan, merchantReference } = req.body;
    if (decodedToken.uid !== uid) {
      res.status(403).json({ error: 'Unauthorized: token UID does not match request UID' });
      return;
    }

    const appCode = process.env.CBE_APP_CODE || '';
    const merchantCode = process.env.CBE_MERCHANT_CODE || '';
    const appSecret = process.env.CBE_APP_SECRET || '';
    const privateKeyB64 = process.env.CBE_PRIVATE_KEY || '';

    if (!appCode || !merchantCode || !appSecret) {
      res.status(500).json({ error: 'CBE payment not configured on server' });
      return;
    }

    const plans = { monthly: 299, yearly: 2999 };
    const amount = plans[plan];
    if (!amount) {
      res.status(400).json({ error: 'Invalid plan: ' + plan });
      return;
    }

    const ref = merchantReference || 'CBE_' + uid + '_' + Date.now();

    const contentToSign = {
      app_code: appCode,
      merchant_code: merchantCode,
      merchant_reference: ref,
      title: 'CBE Movies ' + plan.charAt(0).toUpperCase() + plan.slice(1) + ' Subscription',
      total_amount: amount,
      currency: 'ETB',
      credit_account_number: ''
    };

    const canonicalString = stringify(contentToSign);

    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(canonicalString);
    const confirmPayload = hmac.digest('hex');

    let sign = '';
    if (privateKeyB64) {
      const sk = toByteArray(privateKeyB64);
      const msgBytes = Buffer.from(canonicalString, 'utf-8');
      const sig = nacl.sign.detached(msgBytes, sk);
      sign = fromByteArray(sig);
    }

    const paymentRef = await db.collection('payments').add({
      userId: uid,
      amount,
      plan,
      method: 'cbe_superapp',
      status: 'pending',
      merchantReference: ref,
      createdAt: FieldValue.serverTimestamp()
    });

    const authPayload = {
      x_access_token: '',
      app_code: appCode,
      merchant_code: merchantCode,
      total_amount: amount,
      currency: 'ETB'
    };
    const authCanonical = stringify(authPayload);
    const authHmac = crypto.createHmac('sha256', appSecret);
    authHmac.update(authCanonical);
    const authConfirmPayload = authHmac.digest('hex');

    let authSign = '';
    if (privateKeyB64) {
      const sk = toByteArray(privateKeyB64);
      const msgBytes = Buffer.from(authCanonical, 'utf-8');
      const sig = nacl.sign.detached(msgBytes, sk);
      authSign = fromByteArray(sig);
    }

    res.json({
      success: true,
      paymentId: paymentRef.id,
      orderPayload: contentToSign,
      sign,
      confirm_payload: confirmPayload,
      authPayload,
      auth_sign: authSign,
      auth_confirm_payload: authConfirmPayload
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
