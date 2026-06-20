const CbeSuperApp = {
  APP_CODE: '',
  _callbackId: 0,

  get sdk() {
    return typeof window !== 'undefined' ? window.cbesuperapp : undefined;
  },

  isAvailable() {
    return !!this.sdk;
  },

  _send(functionName, params, callbackName) {
    if (!this.isAvailable()) return;
    const msg = { functionName, params };
    if (callbackName) msg.callbackName = callbackName;
    this.sdk.send(JSON.stringify(msg));
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

  async fetchAccessToken(appCode) {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('fetchAccessToken', {
      appcode: appCode || this.APP_CODE,
      callbackName: cb.name,
      customer_identifier: ''
    }, cb.name);
    return cb.promise;
  },

  async initiatePayment(orderPayload, authPayload, appName) {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('initiatePayment', {
      orderPayload,
      authPayload,
      callbackName: cb.name,
      appName: appName || 'CBE Movies'
    }, cb.name);
    return cb.promise;
  },

  async requestPermissions(permissions) {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('requestPermissions', {
      permissions,
      callbackName: cb.name
    }, cb.name);
    return cb.promise;
  },

  async fetchCurrentLocation() {
    if (!this.isAvailable()) return null;
    const cb = this._makeCallback();
    this._send('fetchCurrentLocation', {
      callbackName: cb.name
    }, cb.name);
    return cb.promise;
  }
};

window.CbeSuperApp = CbeSuperApp;
