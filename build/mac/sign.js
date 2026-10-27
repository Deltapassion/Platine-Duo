// Mac : signature « ad hoc » (sans certificat Apple) puis archive .zip de chaque application
// Sur un Mac, utilise codesign ; ailleurs, rcodesign (https://github.com/indygreg/apple-platform-rs).
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const pkg = require('../../package.json');
const dist = path.join(__dirname, '..', '..', 'dist');
const name = pkg.build.productName + '.app';
const builds = [['mac-arm64', 'arm64'], ['mac', 'x64']];
for (const [dir, arch] of builds) {
  const app = path.join(dist, dir, name);
  if (!fs.existsSync(app)) continue;
  if (process.platform === 'darwin') execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  else execFileSync(process.env.RCODESIGN || 'rcodesign', ['sign', app], { stdio: 'inherit' });
  const zip = path.join(dist, `Platine-Duo-4V-${pkg.version}-mac-${arch}.zip`);
  if (fs.existsSync(zip)) fs.unlinkSync(zip);
  if (process.platform === 'darwin') execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip], { stdio: 'inherit' });
  else execFileSync('zip', ['-qry', zip, name], { cwd: path.dirname(app), stdio: 'inherit' });
  console.log('  •', path.basename(zip));
}
