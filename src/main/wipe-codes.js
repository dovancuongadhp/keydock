const crypto = require('crypto');

const SECRET = Buffer.from('50e7f0f77f6e77f8cb473b4834683c73eeaa451130d031e41d17e880a988b800', 'hex');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function encode(bytes) {
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

function sign(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest();
}

function normalizeWipeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
}

function generateWipeCode() {
  const body = encode(crypto.randomBytes(8));
  const mac = encode(sign(body).subarray(0, 4));
  const raw = `${body}${mac}`;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function verifyWipeCode(input) {
  const raw = normalizeWipeCode(input);
  if (raw.length !== 12) return false;
  const body = raw.slice(0, 8);
  const mac = raw.slice(8);
  const expected = encode(sign(body).subarray(0, 4));
  if (mac.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

module.exports = {
  generateWipeCode,
  verifyWipeCode,
};
