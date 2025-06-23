const CryptoJS = require('crypto-js');

const secretKey = 'b14ca5hA1YA133bbcS00123456789012'

// Encrypt any JavaScript object or string
function encryptData(data) {
  const stringified = typeof data === 'string' ? data : JSON.stringify(data);
  return CryptoJS.AES.encrypt(stringified, secretKey).toString();
}

// Decrypt string and return JSON if possible
function decryptData(encrypted) {
  const bytes = CryptoJS.AES.decrypt(encrypted, secretKey);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  try {
    return JSON.parse(decrypted); // Try to parse JSON
  } catch {
    return decrypted; // Return as plain string if not JSON
  }
}

module.exports = {
  encryptData,
  decryptData,
};
