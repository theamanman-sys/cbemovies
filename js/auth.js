const Auth = {
  currentUser: null,
  userDoc: null,
  listeners: [],

  onAuthStateChanged(cb) {
    this.listeners.push(cb);
    if (this.currentUser !== null) cb(this.currentUser, this.userDoc);
  },

  _notify() {
    this.listeners.forEach(cb => cb(this.currentUser, this.userDoc));
  },

  async register({ email, phone, username, password, firstName, lastName }) {
    await auth.signOut();
    const existing = await db.collection('users').where('username', '==', username).get();
    if (!existing.empty) throw new Error('Username is already taken');
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const doc = {
      email, phone, username, firstName, lastName,
      role: 'user',
      verified: false,
      subscribed: false,
      subscriptionEnd: null,
      subscriptionPlan: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      watchlist: [],
      history: [],
      settings: { autoPlay: true, quality: 'auto', subtitles: true }
    };
    await db.collection('users').doc(uid).set(doc);
    await db.collection('notifications').add({
      type: 'new_user',
      userId: uid,
      email,
      username,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await cred.user.sendEmailVerification();
    return cred;
  },

  async resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    await user.sendEmailVerification();
  },

  async checkEmailVerified() {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    return user.emailVerified;
  },

  canAccessContent(userDoc) {
    if (!userDoc) return false;
    if (userDoc.role === 'admin' || userDoc.role === 'superadmin') return true;
    if (userDoc.subscribed && userDoc.subscriptionEnd) {
      const end = userDoc.subscriptionEnd.toDate ? userDoc.subscriptionEnd.toDate() : new Date(userDoc.subscriptionEnd);
      if (end > new Date()) return true;
    }
    return false;
  },

  async login(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const doc = await db.collection('users').doc(cred.user.uid).get();
    if (!doc.exists) throw new Error('User document not found');
    const data = doc.data();
    if (!data.verified) throw new Error('ACCOUNT_NOT_VERIFIED');
    if (!this.canAccessContent(data)) throw new Error('ACCOUNT_NOT_SUBSCRIBED');
    return cred;
  },

  async loginWithPhone(phoneNumber, appVerifier) {
    return auth.signInWithPhoneNumber(phoneNumber, appVerifier);
  },

  async confirmPhoneCode(confirmationResult, code) {
    const cred = await confirmationResult.confirm(code);
    const doc = await db.collection('users').doc(cred.user.uid).get();
    if (!doc.exists) throw new Error('Account not registered. Please register first.');
    const data = doc.data();
    if (!data.verified) throw new Error('ACCOUNT_NOT_VERIFIED');
    if (!this.canAccessContent(data)) throw new Error('ACCOUNT_NOT_SUBSCRIBED');
    return cred;
  },

  async checkPhoneAuthSubscription() {
    const user = this.currentUser;
    if (!user) throw new Error('No user logged in');
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) throw new Error('Account not registered. Please register first.');
    const data = doc.data();
    if (!data.verified) throw new Error('ACCOUNT_NOT_VERIFIED');
    if (!this.canAccessContent(data)) throw new Error('ACCOUNT_NOT_SUBSCRIBED');
  },

  async logout() {
    await auth.signOut();
  },

  async handleLogout(redirectUrl = 'login.html') {
    try {
      await auth.signOut();
    } catch {}
    window.location.href = redirectUrl;
  },

  async getUserDoc(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async refreshUserDoc() {
    if (!this.currentUser) return null;
    this.userDoc = await this.getUserDoc(this.currentUser.uid);
    this._notify();
    return this.userDoc;
  },

  async updateProfile(uid, data) {
    await db.collection('users').doc(uid).update(data);
    if (this.currentUser?.uid === uid) await this.refreshUserDoc();
  },

  async toggleWatchlist(movieId, item) {
    if (!this.currentUser) return;
    const ref = db.collection('users').doc(this.currentUser.uid);
    const doc = await ref.get();
    const watchlist = doc.data().watchlist || [];
    const idx = watchlist.findIndex(w => w.id === movieId);
    if (idx > -1) { watchlist.splice(idx, 1); } else { watchlist.push({ id: movieId, ...item, addedAt: Date.now() }); }
    await ref.update({ watchlist });
    await this.refreshUserDoc();
    return idx > -1 ? 'removed' : 'added';
  },

  async addToHistory(movieId, item, progress = 0) {
    if (!this.currentUser) return;
    const ref = db.collection('users').doc(this.currentUser.uid);
    const doc = await ref.get();
    let history = doc.data().history || [];
    history = history.filter(h => h.id !== movieId);
    history.unshift({ id: movieId, ...item, progress, watchedAt: firebase.firestore.FieldValue.serverTimestamp() });
    if (history.length > 200) history = history.slice(0, 200);
    await ref.update({ history });
    await this.refreshUserDoc();
  },

  async updateWatchProgress(movieId, progress) {
    if (!this.currentUser) return;
    const ref = db.collection('users').doc(this.currentUser.uid);
    const doc = await ref.get();
    let history = doc.data().history || [];
    const idx = history.findIndex(h => h.id === movieId);
    if (idx > -1) history[idx].progress = progress;
    await ref.update({ history });
  },

  async isAdmin(uid) {
    if (!uid) return false;
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return false;
    const role = doc.data().role;
    return role === 'admin' || role === 'superadmin';
  },

  async isSuperAdmin(uid) {
    if (!uid) return false;
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists && doc.data().role === 'superadmin';
  },

  async hasActiveSubscription(uid) {
    if (!uid) return false;
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return false;
    const data = doc.data();
    if (!data.subscribed || !data.subscriptionEnd) return false;
    const end = data.subscriptionEnd.toDate ? data.subscriptionEnd.toDate() : new Date(data.subscriptionEnd);
    return end > new Date();
  },

  async getAllUsers() {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getNotifications() {
    const snap = await db.collection('notifications').orderBy('createdAt', 'desc').limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async markNotificationRead(id) {
    await db.collection('notifications').doc(id).update({ read: true });
  },

  async getPayments() {
    const snap = await db.collection('payments').orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createPayment(uid, plan) {
    const plans = { monthly: 299, yearly: 2999 };
    const amount = plans[plan] || 299;
    const ref = await db.collection('payments').add({
      userId: uid,
      amount,
      plan,
      method: 'pending',
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id, amount, plan };
  },

  async verifyPayment(paymentId) {
    const ref = db.collection('payments').doc(paymentId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Payment not found');
    const data = doc.data();
    const duration = data.plan === 'yearly' ? 365 : 30;
    const end = new Date();
    end.setDate(end.getDate() + duration);
    await ref.update({ status: 'verified', verifiedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('users').doc(data.userId).update({
      subscribed: true,
      subscriptionEnd: firebase.firestore.Timestamp.fromDate(end),
      subscriptionPlan: data.plan
    });
    return true;
  },

  async createAdminUser(uid, email, role = 'admin') {
    const superAdmin = this.currentUser;
    if (!superAdmin) throw new Error('No user logged in');
    const isSuper = await this.isSuperAdmin(superAdmin.uid);
    if (!isSuper) throw new Error('Only super admin can create admins');
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new Error('User not found');
    await db.collection('users').doc(uid).update({ role, verified: true });
    await db.collection('admins').doc(uid).set({
      uid, email, role,
      addedBy: superAdmin.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async getAllAdmins() {
    const snap = await db.collection('admins').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async removeAdmin(uid) {
    const superAdmin = this.currentUser;
    if (!superAdmin) throw new Error('No user logged in');
    const isSuper = await this.isSuperAdmin(superAdmin.uid);
    if (!isSuper) throw new Error('Only super admin can remove admins');
    const adminDoc = await db.collection('admins').doc(uid).get();
    if (adminDoc.exists && adminDoc.data().role === 'superadmin') {
      throw new Error('Cannot remove super admin');
    }
    await db.collection('users').doc(uid).update({ role: 'user' });
    await db.collection('admins').doc(uid).delete();
  }
};

auth.onAuthStateChanged(async (user) => {
  Auth.currentUser = user;
  if (user) {
    Auth.userDoc = await Auth.getUserDoc(user.uid);
  } else {
    Auth.userDoc = null;
  }
  Auth._notify();
});

window.Auth = Auth;
