const test = require('node:test');
const assert = require('node:assert/strict');
const {
  KDF_ITERATIONS,
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  generatePassword,
} = require('../src/main/crypto');

test('uses PBKDF2-SHA256 with 600000 iterations', () => {
  assert.equal(KDF_ITERATIONS, 600000);
});

test('AES-256-GCM round-trips and uses a fresh IV', async () => {
  const salt = generateSalt();
  assert.equal(salt.length, 16);
  const key = await deriveKey('correct horse battery', salt, 1000);
  const first = encrypt(key, 'p@ssw0rd-ユニコード');
  const second = encrypt(key, 'p@ssw0rd-ユニコード');
  assert.notEqual(first, second);
  assert.equal(decrypt(key, first), 'p@ssw0rd-ユニコード');
  key.fill(0);
});

test('decryption fails when the payload is tampered', async () => {
  const key = await deriveKey('master-password-value', generateSalt(), 1000);
  const encoded = encrypt(key, 'secret');
  const buf = Buffer.from(encoded, 'base64');
  buf[buf.length - 1] ^= 0xff;
  assert.throws(() => decrypt(key, buf.toString('base64')));
  key.fill(0);
});

test('a different key cannot decrypt', async () => {
  const salt = generateSalt();
  const key = await deriveKey('one-password', salt, 1000);
  const other = await deriveKey('other-password', salt, 1000);
  const encoded = encrypt(key, 'secret');
  assert.throws(() => decrypt(other, encoded));
  key.fill(0);
  other.fill(0);
});

test('password generator stays inside the requested alphabet and length', () => {
  const password = generatePassword(24);
  assert.equal(password.length, 24);
  assert.match(password, /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*\-_=+?]+$/);
  assert.throws(() => generatePassword(4));
});
