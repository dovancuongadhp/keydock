const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const electron = require('electron');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keydock-ui-'));
const result = spawnSync(electron, ['.'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
  env: {
    ...process.env,
    KEYDOCK_SMOKE: '1',
    KEYDOCK_USER_DATA: dir,
  },
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
fs.rmSync(dir, { recursive: true, force: true });

const passed = result.status === 0 && (result.stdout || '').includes('ui smoke ok');
process.exit(passed ? 0 : result.status || 1);
