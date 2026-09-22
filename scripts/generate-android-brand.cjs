/* Android artwork derives from the existing P01 master, without redrawing it. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/brand/promlive-mark.svg'), 'utf8');
const size = Number(source.match(/viewBox="0 0 (\d+) \d+"/)[1]);
const rects = [...source.matchAll(/<rect\b[^>]*\/>/g)].map(([tag]) =>
  Object.fromEntries(['x', 'y', 'width', 'height', 'rx'].map(key => [key, Number(tag.match(new RegExp(`${key}="([\\d.]+)"`))[1])])));
assert.equal(size, 144);
assert.equal(rects.length, 3);
const android = 'android/app/src/main/res';
const shapes = rects.map(rect => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${rect.rx}"/>`).join('\n  ');

function write(file, data) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, data);
}
function roundedRectPath({x, y, width: w, height: h, rx: r}) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}
function svg(canvas, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}" role="img" aria-label="Promlive">\n  <title>Promlive</title>\n  ${body}\n</svg>\n`;
}
function mark(color, inset = 0) {
  return `<g fill="${color}" transform="translate(${inset} ${inset}) scale(1)">\n  ${shapes}\n  </g>`;
}
function vector(canvas, markSize, color) {
  const inset = (canvas - markSize) / 2;
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${canvas}dp" android:height="${canvas}dp" android:viewportWidth="${canvas}" android:viewportHeight="${canvas}">
  <group android:translateX="${inset}" android:translateY="${inset}" android:scaleX="${markSize / size}" android:scaleY="${markSize / size}">
${rects.map(rect => `    <path android:fillColor="${color}" android:pathData="${roundedRectPath(rect)}"/>`).join('\n')}
  </group>
</vector>
`;
}

async function main() {
  const app = svg(216, `<rect width="216" height="216" fill="#000000"/>${mark('#FFFFFF', 36)}`);
  const roundApp = app.replace('<rect width="216" height="216" fill="#000000"/>', '<circle cx="108" cy="108" r="108" fill="#000000"/>');
  write('assets/brand/geometry.json', JSON.stringify({size, rects}, null, 2) + '\n');
  for (const [name, color] of [['black', '#000000'], ['white', '#FFFFFF']]) write(`assets/brand/promlive-mark-${name}.svg`, svg(size, mark(color)));
  write('assets/brand/promlive-app-icon.svg', app);
  write('assets/brand/promlive-app-icon-1024.png', await sharp(Buffer.from(app), {density: 384}).resize(1024, 1024).flatten({background: '#000000'}).removeAlpha().png().toBuffer());
  for (const [density, pixels] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    write(`${android}/mipmap-${density}/ic_launcher.png`, await sharp(Buffer.from(app), {density: 384}).resize(pixels, pixels).flatten({background: '#000000'}).removeAlpha().png().toBuffer());
    write(`${android}/mipmap-${density}/ic_launcher_round.png`, await sharp(Buffer.from(roundApp), {density: 384}).resize(pixels, pixels).png().toBuffer());
  }
  write(`${android}/values/brand_colors.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#000000</color>\n</resources>\n');
  // Preserve the adopted launcher geometry: 48 dp mark in a 108 dp layer.
  write(`${android}/drawable/ic_launcher_foreground.xml`, vector(108, 48, '#FFFFFF'));
  // Android draws this 288 dp canvas and masks its outer third. The 108 dp
  // mark stays inside the safe circle and reverses color with the launch theme.
  write(`${android}/drawable/promlive_splash_mark.xml`, vector(288, 108, '@color/launch_foreground'));
  for (const version of [26, 33]) for (const name of ['ic_launcher', 'ic_launcher_round']) {
    write(`${android}/mipmap-anydpi-v${version}/${name}.xml`, `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
${version >= 33 ? '  <monochrome android:drawable="@drawable/ic_launcher_foreground"/>\n' : ''}</adaptive-icon>
`);
  }
  console.log('Generated Android launcher and launch-screen artwork from the P01 master.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
