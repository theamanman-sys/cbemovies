const CbeSuperApp = {
  APP_CODE: '',
  _callbacks: {},
  _callbackId: 0,

  get sdk() {
    return typeof window !== 'undefined' ? window.cbesuperapp : undefined;
  },

  isAvailable() {
    return !!this.sdk;
  },

  _send(functionName, params, callbackName) {
    if (!this.isAvailable()) return;
    const payload = JSON.stringify({ functionName, params, callbackName });
    this.sdk.send(payload);
  },

  _makeCallback() {
    const id = ++this._callbackId;
    const name = '__cbe_cb_' + id;
    return new Promise(resolve => {
      this._callbacks[name] = resolve;
      window[name] = result => {
        delete window[name];
        delete this._callbacks[name];
        resolve(result);
      };
      setTimeout(() => {
        if (this._callbacks[name]) {
          delete window[name];
          delete this._callbacks[name];
          resolve(null);
        }
      }, 30000);
    });
  },

  async fetchAccessToken(appCode) {
    if (!this.isAvailable()) return null;
    const callbackName = '__cbe_token_cb';
    this._send('fetchAccessToken', {
      appcode: appCode || this.APP_CODE,
      callbackName,
      customer_identifier: ''
    }, callbackName);
    return this._makeCallback();
  },

  async initiatePayment(orderPayload, authPayload, appName) {
    if (!this.isAvailable()) return null;
    const callbackName = '__cbe_pay_cb';
    this._send('initiatePayment', {
      orderPayload,
      authPayload,
      callbackName,
      appName: appName || 'CBE Movies'
    }, callbackName);
    return this._makeCallback();
  },

  async requestPermissions(permissions) {
    if (!this.isAvailable()) return null;
    const callbackName = '__cbe_perm_cb';
    this._send('requestPermissions', {
      permissions,
      callbackName
    }, callbackName);
    return this._makeCallback();
  },

  async fetchCurrentLocation() {
    if (!this.isAvailable()) return null;
    const callbackName = '__cbe_loc_cb';
    this._send('fetchCurrentLocation', {
      callbackName
    }, callbackName);
    return this._makeCallback();
  }
};

window.CbeSuperApp = CbeSuperApp;
