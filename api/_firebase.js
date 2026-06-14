const admin = require('firebase-admin');

let initialized = false;

function getFirebase() {
  if (initialized) return { admin, app: admin.app(), db: admin.firestore(), auth: admin.auth() };
  initialized = true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else if (process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    });
  } else {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'cbe-movies' });
  }
  return { admin, app: admin.app(), db: admin.firestore(), auth: admin.auth() };
}

module.exports = getFirebase;
