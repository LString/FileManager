// src/store-manager.js
const Store = require('electron-store');

const schema = {
  credentials: {
    type: 'object',
    properties: {
      username: { type: 'string' },
      password: { type: 'string' }
    },
    default: {}
  },
  rememberMe: { type: 'boolean', default: false }//预留
};

class StoreManager {
  constructor() {
    console.log('StoreManager init success');
    this.store = new Store({ schema });
    console.log('StoreManager path:', this.store.path); 
  }

  saveCredentials(username, password, rememberMe) {

    this.store.set('credentials', { username, password });if (typeof username !== 'string' || typeof password !== 'string') {
      throw new Error('凭证必须为字符串类型');
    }
    
    // 使用完整对象覆盖存储
    this.store.set('credentials', { 
      username: username.trim(), 
      password: password.trim() 
    });
    
    this.store.set('rememberMe', rememberMe);
  }

  getCredentials() {
    const credentials = this.store.get('credentials');
    // 确保返回有效对象
    return credentials && typeof credentials === 'object' 
      ? {
          ...credentials,
          rememberMe: this.store.get('rememberMe')
        }
      : { username: '', password: '' }; // 返回符合schema的结构
  }

  clearCredentials() {
    this.store.set('credentials', {});
    this.store.set('rememberMe', false);
  }
}

module.exports = StoreManager;