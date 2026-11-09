const test = require('node:test');
const assert = require('node:assert/strict');
const { generateWipeCode, verifyWipeCode } = require('../src/main/wipe-codes');

test('a generated wipe code verifies, and a changed code does not', () => {
  const code = generateWipeCode();
  assert.equal(verifyWipeCode(code), true);
  assert.equal(verifyWipeCode(code.toLowerCase()), true);
  assert.equal(verifyWipeCode(`  ${code}  `), true);
  assert.equal(verifyWipeCode('XOA VAULT'), false);
  const broken = `${code.slice(0, -1)}${code.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(verifyWipeCode(broken), false);
});
