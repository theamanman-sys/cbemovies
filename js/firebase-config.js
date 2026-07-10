const firebaseConfig = {
  apiKey: "AIzaSyDAyabIEsOSRbAytRE4MvQOg1B9BKWbNO8",
  authDomain: "cbemovies.firebaseapp.com",
  projectId: "cbemovies",
  storageBucket: "cbemovies.firebasestorage.app",
  messagingSenderId: "67193419144",
  appId: "1:67193419144:web:da920db71c730a3282b63d",
  measurementId: "G-3Y5GFBYBK4"
};

firebase.initializeApp(firebaseConfig);
auth = firebase.auth();
db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch(err => console.warn('Firestore persistence not enabled:', err));
