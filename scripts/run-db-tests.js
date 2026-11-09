const path = require('path');
const { spawnSync } = require('child_process');
const electron = require('electron');

const result = spawnSync(electron, [path.join(__dirname, '../test/db.test.js')], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

process.exit(result.status === null ? 1 : result.status);
