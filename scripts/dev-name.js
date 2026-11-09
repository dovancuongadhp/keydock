const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appPath = path.join(root, 'node_modules/electron/dist/Electron.app');
const plist = path.join(appPath, 'Contents/Info.plist');
const buddy = '/usr/libexec/PlistBuddy';

function readKey(key) {
  return execFileSync(buddy, ['-c', `Print :${key}`, plist], { encoding: 'utf8' }).trim();
}

if (!fs.existsSync(plist)) {
  process.stderr.write('Không thấy Electron.app, bỏ qua đổi tên.\n');
  process.exit(0);
}

const needsName = readKey('CFBundleName') !== 'KeyDock' || readKey('CFBundleDisplayName') !== 'KeyDock';
const iconDest = path.join(appPath, 'Contents/Resources/electron.icns');
const iconSrc = path.join(root, 'build/icon.icns');
const needsIcon = fs.existsSync(iconSrc) && (!fs.existsSync(iconDest) || fs.readFileSync(iconSrc).compare(fs.readFileSync(iconDest)) !== 0);

if (!needsName && !needsIcon) process.exit(0);

if (needsName) {
  execFileSync(buddy, ['-c', 'Set :CFBundleName KeyDock', plist]);
  execFileSync(buddy, ['-c', 'Set :CFBundleDisplayName KeyDock', plist]);
}
if (needsIcon) fs.copyFileSync(iconSrc, iconDest);

execFileSync('codesign', ['--force', '--sign', '-', appPath], { stdio: 'inherit' });
