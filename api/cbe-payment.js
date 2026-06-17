const crypto = require('crypto');
const getFirebase = require('./_firebase');

function stableStringify(obj) {
  function serialize(v) {
    if (v === null) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') {
      if (Number.isNaN(v) || !Number.isFinite(v)) throw new Error('NaN/Infinity');
      if (Number.isInteger(v) && Math.abs(v) < 1e21) return v.toString();
      return v.toString();
    }
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(serialize).join(',') + ']';
    if (typeof v === 'object') {
      const keys = Object.keys(v).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + serialize(v[k])).join(',') + '}';
    }
    return '';
  }
  return serialize(obj);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { uid, plan, merchantReference } = req.body;

    const appCode = process.env.CBE_APP_CODE || '';
    const merchantCode = process.env.CBE_MERCHANT_CODE || '';
    const appSecret = process.env.CBE_APP_SECRET || '';
    const privateKeyB64 = process.env.CBE_PRIVATE_KEY || '';
    const xApiKey = process.env.CBE_X_API_KEY || '';

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

    const canonicalString = stableStringify(contentToSign);

    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(canonicalString);
    const confirmPayload = hmac.digest('hex');

    let sign = '';
    if (privateKeyB64) {
      const nacl = require('tweetnacl');
      const { toByteArray, fromByteArray } = require('base64-js');
      const sk = toByteArray(privateKeyB64);
      const msgBytes = Buffer.from(canonicalString, 'utf-8');
      const sig = nacl.sign.detached(msgBytes, sk);
      sign = fromByteArray(sig);
    }

    const { db, FieldValue } = getFirebase();
    const paymentRef = await db.collection('payments').add({
      userId: uid,
      amount,
      plan,
      method: 'cbe_superapp',
      status: 'pending',
      merchantReference: ref,
      createdAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      paymentId: paymentRef.id,
      orderPayload: contentToSign,
      sign,
      confirm_payload: confirmPayload,
      authPayload: {
        xApiKey
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
