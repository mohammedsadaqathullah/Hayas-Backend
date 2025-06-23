const CryptoJS = require('crypto-js');
const validationKey = require('../validationkey')

// Encrypt any JavaScript object or string
function encryptData(data) {
  const toJsObject = data.toObject();
   const encryptedData = CryptoJS.AES.encrypt(toJsObject, validationKey).toString();
  const uriEncoded = encodeURIComponent(encryptedData);
  return uriEncoded; // Return URI encoded string
}

// Decrypt string and return JSON if possible
function decryptData(encrypted) {
  const decode = decodeURIComponent(encrypted)
  const bytes = CryptoJS.AES.decrypt(decode, validationKey);
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
