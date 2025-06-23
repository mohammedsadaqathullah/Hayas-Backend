const CryptoJS = require('crypto-js');
const validationKey = require('../validationkey')

// Encrypt any JavaScript object or string
function encryptData(data) {
   const encryptedData = CryptoJS.AES.encrypt(data, validationKey).toString();
  const uriEncoded = encodeURIComponent(encryptedData);
  return uriEncoded; // Return URI encoded string
}

// Decrypt string and return JSON if possible
function decryptData(encrypted) {
  const bytes = CryptoJS.AES.decrypt(encrypted, validationKey);
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
