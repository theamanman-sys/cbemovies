const PLANS = {
  monthly: { name: 'Monthly', price: 299, priceLabel: '299 ETB', devices: 1, save: null },
  yearly: { name: 'Yearly', price: 2999, priceLabel: '2,999 ETB', devices: 2, save: 'Save 16%' }
};

const Payment = {
  plan: null,
  method: null,
  ref: null,
  qrInstance: null,
  chapaWindow: null,

  init() {
    const params = new URLSearchParams(location.search);
    const planParam = params.get('plan');

    if (params.get('chapa_ref')) {
      this.checkChapaVerification(params.get('chapa_ref'));
    }

    this.setupPlanSelection();

    if (planParam && PLANS[planParam]) {
      this.selectPlan(planParam);
    }
  },

  generateRef() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'CBE-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.ref = result;
    return result;
  },

  setupPlanSelection() {
    document.querySelectorAll('.select-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectPlan(btn.dataset.plan);
      });
    });

    document.querySelectorAll('.payment-plan-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.select-plan-btn')) return;
        this.selectPlan(card.dataset.plan);
      });
    });

    document.querySelectorAll('.payment-method').forEach(el => {
      el.addEventListener('click', () => {
        this.selectMethod(el.dataset.method);
      });
    });

    document.getElementById('download-qr-btn')?.addEventListener('click', () => this.downloadQR());
    document.getElementById('wa-share-btn')?.addEventListener('click', () => this.shareViaWhatsApp());
    document.getElementById('manual-verify-btn')?.addEventListener('click', () => this.manualVerify());
    document.getElementById('superapp-pay-btn-pay')?.addEventListener('click', () => this.payWithSuperApp());
    document.getElementById('chapa-pay-btn')?.addEventListener('click', () => this.payWithChapa());
    document.getElementById('telebirr-verify-btn')?.addEventListener('click', () => this.verifyTelebirr());
  },

  selectPlan(plan) {
    this.plan = plan;
    const p = PLANS[plan];
    if (!p) return;

    document.querySelectorAll('.payment-plan-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.payment-plan-card[data-plan="${plan}"]`)?.classList.add('selected');

    document.getElementById('summary-plan-name').textContent = p.name;
    this.generateRef();

    document.getElementById('summary-plan-price').textContent = p.priceLabel;
    document.getElementById('summary-ref-display').textContent = this.ref;

    document.getElementById('step-plan').style.display = 'none';
    document.getElementById('step-payment').style.display = 'block';

    document.getElementById('wa-plan').textContent = p.name;
    document.getElementById('wa-amount').textContent = p.priceLabel;
    document.getElementById('wa-ref').textContent = this.ref;

    document.getElementById('telebirr-amount').textContent = p.priceLabel;
    document.getElementById('telebirr-ref-display').textContent = this.ref;
    document.getElementById('telebirr-ref').value = '';
    document.getElementById('manual-ref').value = '';
    document.getElementById('payment-error').textContent = '';

    this.generateQR();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  selectMethod(method) {
    this.method = method;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
    document.querySelector(`.payment-method[data-method="${method}"]`)?.classList.add('active');

    document.querySelectorAll('.method-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById('panel-' + method);
    if (panel) panel.style.display = 'block';

    document.getElementById('section-qr').style.display = 'block';

    if (method === 'whatsapp') {
      this.updateWhatsAppLink();
    }

    if (method === 'telebirr') {
      this.generateTelebirrQR();
    }
  },

  generateQR() {
    const container = document.getElementById('qrcode');
    if (!container) return;

    container.innerHTML = '';

    const user = Auth.currentUser;
    const text = [
      'CBE MOVIES SUBSCRIPTION',
      'Plan: ' + (PLANS[this.plan]?.name || this.plan),
      'Amount: ' + (PLANS[this.plan]?.priceLabel || ''),
      'Ref: ' + this.ref,
      'User: ' + (user?.uid?.slice(0, 8) || ''),
      'Date: ' + new Date().toISOString().split('T')[0]
    ].join('\n');

    if (typeof QRCode !== 'undefined') {
      this.qrInstance = new QRCode(container, {
        text,
        width: 200,
        height: 200,
        colorDark: '#ffffff',
        colorLight: '#1a1a1a',
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : undefined
      });
    } else {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px">QR code library loading... <a href="https://wa.me/2519XXXXXXXX?text=My+ref:+' + this.ref + '" target="_blank" style="color:var(--accent)">Click here for WhatsApp</a></p>';
    }

    const refEl = document.getElementById('qr-ref-code');
    if (refEl) refEl.textContent = this.ref;
  },

  generateTelebirrQR() {
    const container = document.getElementById('telebirr-qrcode');
    if (!container) return;

    container.innerHTML = '';

    const text = 'TELEBIRR PAY\nMerchant: CBE Movies\nAccount: +251900000000\nRef: ' + this.ref + '\nAmount: ' + (PLANS[this.plan]?.priceLabel || '');

    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text,
        width: 160,
        height: 160,
        colorDark: '#ffffff',
        colorLight: '#1a1a1a'
      });
    }
  },

  downloadQR() {
    const canvas = document.querySelector('#qrcode canvas');
    if (!canvas) {
      this.showToast('Generate the QR code first');
      return;
    }
    const link = document.createElement('a');
    link.download = 'CBE-Movies-' + (this.plan || 'subscription') + '-' + this.ref + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  },

  updateWhatsAppLink() {
    const link = document.getElementById('whatsapp-link');
    if (!link) return;
    const p = PLANS[this.plan];
    const msg = encodeURIComponent(
      'Hi CBE Movies! I want to subscribe to the ' + (p?.name || '') + ' plan (' + (p?.priceLabel || '') + ').' +
      '\n\nMy Reference: ' + this.ref +
      '\n\nI have attached my payment screenshot and subscription QR code.'
    );
    link.href = 'https://wa.me/251900000000?text=' + msg;
  },

  shareViaWhatsApp() {
    this.updateWhatsAppLink();
    const link = document.getElementById('whatsapp-link');
    if (link) {
      window.open(link.href, '_blank');
    }
  },

  async payWithSuperApp() {
    const loading = document.getElementById('superapp-loading');
    const panel = document.getElementById('panel-cbe_superapp');
    const errorEl = document.getElementById('payment-error');
    errorEl.textContent = '';

    if (typeof CbeSuperApp === 'undefined' || !CbeSuperApp.isAvailable()) {
      errorEl.textContent = 'CBE SuperApp is not available on this device. Please use another payment method.';
      return;
    }

    panel.style.display = 'none';
    loading.style.display = 'block';

    try {
      const idToken = await Auth.currentUser.getIdToken();
      const signRes = await fetch('/api/cbe-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ uid: Auth.currentUser.uid, plan: this.plan })
      });
      const signData = await signRes.json();
      if (!signData.success) throw new Error(signData.error || 'Payment setup failed');

      const payResult = await CbeSuperApp.initiatePayment(
        { ...signData.orderPayload, sign: signData.sign, confirm_payload: signData.confirm_payload },
        { ...signData.authPayload, xAccessToken: '' },
        'CBE Movies'
      );

      if (!payResult || payResult.status !== 'success') {
        throw new Error(payResult?.error || 'Payment was not completed');
      }

      await db.collection('payments').doc(signData.paymentId).update({
        transactionRef: payResult.data?.ft_number || '',
        status: 'verified',
        method: 'cbe_superapp',
        verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const duration = this.plan === 'yearly' ? 365 : 30;
      const end = new Date();
      end.setDate(end.getDate() + duration);
      await db.collection('users').doc(Auth.currentUser.uid).update({
        subscribed: true,
        subscriptionEnd: firebase.firestore.Timestamp.fromDate(end),
        subscriptionPlan: this.plan
      });

      this.showPaymentSuccess();
    } catch (err) {
      errorEl.textContent = err.message;
      loading.style.display = 'none';
      panel.style.display = 'block';
    }
  },

  async payWithChapa() {
    const loading = document.getElementById('chapa-loading');
    const panel = document.getElementById('panel-chapa');
    const errorEl = document.getElementById('payment-error');
    errorEl.textContent = '';

    panel.style.display = 'none';
    loading.style.display = 'block';

    try {
      const idToken = await Auth.currentUser.getIdToken();
      const initRes = await fetch('/api/chapa-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ uid: Auth.currentUser.uid, plan: this.plan })
      });
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error || 'Chapa initialization failed');

      this.chapaWindow = window.open(initData.checkoutUrl, '_blank');
      if (!this.chapaWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      this.showToast('Chapa payment page opened in a new tab. Complete payment there, then come back to verify.');

      const checkInterval = setInterval(async () => {
        try {
          const verifyRes = await fetch('/api/chapa-verify?txRef=' + initData.txRef);
          const verifyData = await verifyRes.json();
          if (verifyData.verified) {
            clearInterval(checkInterval);
            this.showPaymentSuccess();
          }
        } catch {}
      }, 3000);

      setTimeout(() => {
        clearInterval(checkInterval);
        loading.style.display = 'none';
        panel.style.display = 'block';
        document.getElementById('section-manual-verify').style.display = 'block';
        document.getElementById('manual-verify-btn').dataset.txRef = initData.txRef;
        document.getElementById('manual-ref').placeholder = 'Enter Chapa transaction reference';
        this.showToast('Still waiting for payment. Click "Verify Payment" after completing the transaction.');
      }, 120000);
    } catch (err) {
      errorEl.textContent = err.message;
      loading.style.display = 'none';
      panel.style.display = 'block';
    }
  },

  async checkChapaVerification(txRef) {
    this.showToast('Verifying your payment...');
    try {
      const verifyRes = await fetch('/api/chapa-verify?txRef=' + txRef);
      const verifyData = await verifyRes.json();
      if (verifyData.verified) {
        this.showPaymentSuccess();
      } else {
        const params = new URLSearchParams(location.search);
        params.delete('chapa_ref');
        const newUrl = location.pathname + (params.toString() ? '?' + params.toString() : '');
        history.replaceState(null, '', newUrl);
        this.showToast('Payment not yet confirmed. Please try again or use another method.');
      }
    } catch (err) {
      this.showToast('Verification failed: ' + err.message);
    }
  },

  async verifyTelebirr() {
    const ref = document.getElementById('telebirr-ref').value.trim();
    const errorEl = document.getElementById('payment-error');
    if (!ref) { errorEl.textContent = 'Enter your Telebirr transaction reference'; return; }

    try {
      const payment = await Auth.createPayment(Auth.currentUser.uid, this.plan);
      await db.collection('payments').doc(payment.id).update({
        transactionRef: ref,
        method: 'telebirr'
      });
      await Auth.verifyPayment(payment.id);
      this.showPaymentSuccess();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  },

  async manualVerify() {
    const ref = document.getElementById('manual-ref').value.trim();
    const errorEl = document.getElementById('payment-error');
    if (!ref) { errorEl.textContent = 'Enter your transaction reference'; return; }

    const btn = document.getElementById('manual-verify-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    errorEl.textContent = '';

    try {
      const txRef = btn.dataset.txRef;
      if (txRef) {
        const verifyRes = await fetch('/api/chapa-verify?txRef=' + txRef);
        const verifyData = await verifyRes.json();
        if (verifyData.verified) {
          this.showPaymentSuccess();
          return;
        }
      }

      const payment = await Auth.createPayment(Auth.currentUser.uid, this.plan);
      await db.collection('payments').doc(payment.id).update({
        transactionRef: ref,
        method: this.method || 'manual'
      });
      await Auth.verifyPayment(payment.id);
      this.showPaymentSuccess();
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Verify Payment';
    }
  },

  showPaymentSuccess() {
    document.getElementById('step-payment').style.display = 'none';
    document.getElementById('section-manual-verify').style.display = 'none';

    const qrSection = document.getElementById('section-qr');
    if (qrSection) qrSection.style.display = 'block';

    const successEl = document.getElementById('payment-success');
    if (successEl) successEl.style.display = 'block';

    this.showToast('Payment successful! Subscription activated.', 'success');

    setTimeout(() => {
      window.location.href = 'profile.html#subscription';
    }, 3000);
  },

  showToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast active ' + (type || '');
    setTimeout(() => { t.className = 'toast'; }, 5000);
  }
};

Auth.onAuthStateChanged((user, doc) => {
  if (!user) {
    localStorage.setItem('redirect_after_login', location.href);
    window.location.href = 'login.html';
    return;
  }
  if (doc && Auth.canAccessContent(doc)) {
    document.querySelector('.payment-page').innerHTML = '<div class="payment-success-container"><h2>✓ Subscription Active</h2><p>You already have an active subscription.</p><a href="profile.html#subscription" class="auth-btn" style="display:inline-block;margin-top:20px">Go to Profile</a></div>';
    return;
  }
  Payment.init();
});
