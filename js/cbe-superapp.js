const CbeSuperApp = {
  APP_CODE: 'CBE_MOVIES',
  _callbackId: 0,

  get sdk() {
    return typeof window !== 'undefined' ? window.cbesuperapp : undefined;
  },

  isAvailable() {
    return !!this.sdk;
  },

  _send(functionName, params) {
    if (!this.isAvailable()) return;
    this.sdk.send(JSON.stringify({ functionName, params }));
  },

  _makeCallback(timeout = 30000) {
    const name = '__cbe_cb_' + (++this._callbackId);
    const promise = new Promise(resolve => {
      window[name] = result => {
        delete window[name];
        resolve(result);
      };
      setTimeout(() => {
        if (window[name]) {
          delete window[name];
          resolve(null);
        }
      }, timeout);
    });
    return { name, promise };
  },

  async fetchAccessToken(appCode, customerIdentifier) {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('fetchAccessToken', {
      appcode: appCode || this.APP_CODE,
      customer_identifier: customerIdentifier || '',
      callbackName: cb.name
    });
    return cb.promise;
  },

  async initiatePayment(orderPayload, authPayload, appName) {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('initiatePayment', {
      orderPayload,
      authPayload,
      appName: appName || 'CBE Movies',
      callbackName: cb.name
    });
    return cb.promise;
  },

  async requestPermissions(permissions) {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('requestPermissions', {
      permissions,
      callbackName: cb.name
    });
    return cb.promise;
  },

  async fetchCurrentLocation() {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('fetchCurrentLocation', {
      callbackName: cb.name
    });
    return cb.promise;
  }
};

window.CbeSuperApp = CbeSuperApp;
