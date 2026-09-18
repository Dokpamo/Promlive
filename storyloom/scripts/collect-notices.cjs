const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const notices = ['# Installed npm runtime dependency notices', '', 'Generated from package-lock.json and installed package license files. Native dependency notices are recorded separately.', ''];
let count = 0;
for (const [relative, entry] of Object.entries(lock.packages)) {
  if (!relative || entry.dev) continue;
  const directory = path.join(root, relative);
  const manifest = path.join(directory, 'package.json');
  if (!fs.existsSync(manifest)) continue;
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const files = fs.readdirSync(directory).filter(name => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
  notices.push(`## ${pkg.name} ${pkg.version}`, '', `License: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? 'see package')}`, '');
  for (const file of files) notices.push(`### ${file}`, '', '```text', fs.readFileSync(path.join(directory, file), 'utf8').replaceAll('```', "'''"), '```', '');
  if (!files.length) notices.push('No top-level license file was included by this package. Consult its published source before redistribution.', '');
  count++;
}
fs.mkdirSync(path.join(root, 'docs/licenses'), {recursive: true});
fs.writeFileSync(path.join(root, 'docs/THIRD_PARTY_NOTICES.md'), notices.join('\n'));
for (const [source, target] of [
  ['ios/Pods/Target Support Files/Pods-Storyloom/Pods-Storyloom-acknowledgements.markdown', 'ios-pods.md'],
  ['macos/Pods/Target Support Files/Pods-storyloom-macOS/Pods-storyloom-macOS-acknowledgements.markdown', 'macos-pods.md'],
]) if (fs.existsSync(path.join(root, source))) fs.copyFileSync(path.join(root, source), path.join(root, 'docs/licenses', target));
console.log(`Collected notices for ${count} installed runtime packages.`);
