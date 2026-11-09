const crypto = require('crypto');

const KDF_ITERATIONS = 600000;
const KDF_DIGEST = 'sha256';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERIFIER_PLAINTEXT = 'keydock.verifier.v1';
const MAX_PLAINTEXT_LENGTH = 1000000;

function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH);
}

function deriveKey(password, salt, iterations = KDF_ITERATIONS) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, KEY_LENGTH, KDF_DIGEST, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

// Layout: 12-byte IV || 16-byte GCM tag || ciphertext, then base64.
function encrypt(key, plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString('base64');
}

function decrypt(key, payload) {
  const buf = Buffer.from(String(payload), 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Ciphertext is too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const body = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  if (plain.length > MAX_PLAINTEXT_LENGTH) {
    throw new Error('Plaintext is too large');
  }
  return plain;
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function generatePassword(length = 20) {
  const size = Number(length);
  if (!Number.isInteger(size) || size < 12 || size > 128) {
    throw new Error('Password length must be between 12 and 128');
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += alphabet[crypto.randomInt(alphabet.length)];
  }
  return out;
}

module.exports = {
  KDF_ITERATIONS,
  VERIFIER_PLAINTEXT,
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  safeEqual,
  generatePassword,
};
