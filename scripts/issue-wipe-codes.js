const { generateWipeCode } = require('../src/main/wipe-codes');

const count = Math.min(50, Math.max(1, Number(process.argv[2]) || 10));
for (let index = 0; index < count; index += 1) {
  process.stdout.write(`${generateWipeCode()}\n`);
}
