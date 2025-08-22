const crypto = require('crypto');

class AES256 {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.key = null;
    this.ivStrategy = 'hashed'; // 可选 hashed | random
  }

  /**
   * 初始化加密器（使用哈希策略）
   * @param {string} password - 原始密码
   * @param {string} [ivStrategy=hashed] - IV生成策略 (hashed|random)
   */
  init(password, ivStrategy = 'hashed') {
    // 生成固定长度密钥（SHA-256哈希）
    const hash = crypto.createHash('sha256');
    hash.update(password);
    this.key = hash.digest();
    
    // 设置IV生成策略
    this.ivStrategy = ivStrategy || 'hashed';
  }

  // 加密方法
  encrypt(text) {
    if(text == null) return null
    if (!this.key) throw new Error('Encryption key not initialized');
    
    // 根据策略生成IV
    const iv = this.generateIV();
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 返回结构包含IV生成策略标识
    return this.ivStrategy === 'hashed' 
      ? encrypted  // 哈希策略的IV可重现，无需存储
      : `${iv.toString('hex')}:${encrypted}`;
  }

  // 解密方法
  decrypt(encryptedText) {
    try {
      if (!this.key) throw new Error('解密密钥未初始化');
      if (!encryptedText) return '';

      let iv, encrypted;
      if (this.ivStrategy === 'random') {
        // 解析随机策略的IV
        [iv, encrypted] = encryptedText.split(':');
        iv = Buffer.from(iv, 'hex');
      } else {
        // 哈希策略重新生成IV
        iv = this.generateIV();
        encrypted = encryptedText;
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('解密失败:', error.message);
      return '[加密数据损坏]';
    }
  }

  /**
   * 生成IV（哈希策略时从密钥派生）
   */
  generateIV() {
    if (this.ivStrategy === 'hashed') {
      // 从密钥派生固定IV
      const ivHash = crypto.createHash('sha256')
        .update(this.key)
        .digest();
      return ivHash.slice(0, 16); // 取前128位
    }
    // 随机生成IV（需要存储）
    return crypto.randomBytes(16);
  }
}

module.exports = AES256;