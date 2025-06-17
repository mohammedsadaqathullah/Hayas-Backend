const CryptoJS = require("crypto-js");
const validationKey = require("../validationkey");

const decryptEmail = (encryptedEmail) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedEmail, validationKey);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedText) {
      throw new Error("Decryption resulted in empty string");
    }

    return decryptedText;
  } catch (err) {
    throw new Error("Failed to decrypt email: " + err.message);
  }
};

module.exports = decryptEmail;
