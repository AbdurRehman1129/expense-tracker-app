import CryptoJS from 'crypto-js';

// Not a secret in the traditional sense — combined with the user's stable Google
// account ID at runtime to derive a per-user key, so nothing sensitive is stored on disk.
const APP_SALT = 'expense-tracker-app-v1-salt';

export function deriveKey(googleUserId: string): string {
  return CryptoJS.SHA256(googleUserId + APP_SALT).toString();
}

export function encryptData(plainText: string, key: string): string {
  return CryptoJS.AES.encrypt(plainText, key).toString();
}

export function decryptData(cipherText: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}