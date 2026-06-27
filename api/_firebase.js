const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const cert = typeof admin.cert === 'function' ? admin.cert : admin.credential.cert;
const getDefaultApp = typeof admin.getApp === 'function' ? () => admin.getApp() : () => admin.app();

let initialized = false;

function getFirebase() {
  if (initialized) {
    return { admin, app: getDefaultApp(), db: getFirestore(getDefaultApp()), auth: getAuth(getDefaultApp()), FieldValue, Timestamp };
  }
  initialized = true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8');
    const sa = JSON.parse(json);
    admin.initializeApp({ credential: cert(sa) });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    try {
      const sa = JSON.parse(raw);
      admin.initializeApp({ credential: cert(sa) });
    } catch {
      raw = raw.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ');
      const sa = JSON.parse(raw);
      admin.initializeApp({ credential: cert(sa) });
    }
  } else if (process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    });
  } else {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'cbe-movies' });
  }
  return { admin, app: getDefaultApp(), db: getFirestore(getDefaultApp()), auth: getAuth(getDefaultApp()), FieldValue, Timestamp };
}

module.exports = getFirebase;
