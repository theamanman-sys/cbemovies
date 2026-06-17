const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let initialized = false;

function getFirebase() {
  if (initialized) {
    const app = admin.app();
  return { admin, app, db: getFirestore(app), auth: getAuth(app), FieldValue, Timestamp };
  }
  initialized = true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.cert(sa) });
  } else if (process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    });
  } else {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'cbe-movies' });
  }
  const app = admin.app();
  return { admin, app, db: getFirestore(app), auth: getAuth(app), FieldValue };
}

module.exports = getFirebase;
