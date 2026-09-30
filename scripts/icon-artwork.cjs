// Original Promlive artwork. 32-unit grid, open counters, rounded strokes.
// Generate SVG exports and native masks with generate-navigation-icons.cjs.
const home = 'M13.9 4.18Q16 2.5 18.1 4.18L26.35 11.18Q28.5 13.03 28.5 15.9V24.1Q28.5 28.5 24.1 28.5H7.9Q3.5 28.5 3.5 24.1V15.9Q3.5 13.03 5.65 11.18Z';
const bubble = 'M16 3.7C9.2 3.7 3.7 9.18 3.7 15.95S9.2 28.2 16 28.2C18.215 28.2 20.3 27.63 22.11 26.575L28.1 27.9L27.015 21.5C27.875 19.83 28.3 17.965 28.3 15.95C28.3 9.18 22.8 3.7 16 3.7Z';
const plus = 'M16 10V22M10 16H22';
const head = '<circle cx="16" cy="9.1" r="5.3"/>';
const shoulders = 'M4.8 28.2C5.7 22.5 10 19.4 16 19.4S26.3 22.5 27.2 28.2';

function gearPath() {
  const vertices = [];
  for (let i = 0; i < 6; i++) {
    for (const [offset, radius] of [[-10.5, 12.65], [10.5, 12.65], [22, 10.35], [38, 10.35]]) {
      const a = (-90 + i * 60 + offset) * Math.PI / 180;
      vertices.push([16 + Math.cos(a) * radius * 1.035, 16 + Math.sin(a) * radius]);
    }
  }
  const f = n => Number(n.toFixed(3));
  const toward = (a, b) => {
    const t = Math.min(.46, .95 / Math.hypot(b[0] - a[0], b[1] - a[1]));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  return vertices.map((v, i) => {
    const before = toward(v, vertices[(i + vertices.length - 1) % vertices.length]);
    const after = toward(v, vertices[(i + 1) % vertices.length]);
    return `${i ? 'L' : 'M'}${f(before[0])} ${f(before[1])}Q${f(v[0])} ${f(v[1])} ${f(after[0])} ${f(after[1])}`;
  }).join('') + 'Z';
}
const gear = gearPath();
const path = d => `<path d="${d}"/>`;
const solid = d => `<path d="${d}" fill="currentColor" stroke="none"/>`;
const circle = (r, attrs = '') => `<circle cx="16" cy="16" r="${r}" ${attrs}/>`;
const cutout = (name, body, cuts) => `<defs><mask id="${name}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="white" stroke="none"/>${cuts}</mask></defs><g mask="url(#${name}-cut)">${body}</g>`;

// Approved sample geometry. Separate layers keep the outer stroke stable during fill.
const tabArtwork = {
  library: {weight: 2.65, outline: path(home), fill: solid(home)},
  chats: {weight: 2.4, outline: path(bubble), fill: solid(bubble)},
  create: {
    weight: 2.4, outline: circle(12.45), details: path(plus),
    fill: cutout('create', circle(12.45, 'fill="currentColor" stroke="none"'), `<path d="${plus}" fill="none" stroke="black" stroke-width="2.4"/>`),
  },
  settings: {
    weight: 2.3, outline: path(gear), details: circle(4.45),
    // Optical correction: only the selected counter grows; the default ring stays put.
    fill: cutout('settings', solid(gear), circle(4.85, 'fill="black" stroke="none"')),
  },
};

const icons = {
  ...Object.fromEntries(Object.entries(tabArtwork).flatMap(([name, art]) => [
    [name, art.outline + (art.details || '')],
    [`${name}Selected`, art.fill + art.outline],
  ])),
  plus: '<path d="M4 16H28M16 4V28"/>',
  search: '<circle cx="13.6" cy="13.6" r="9.7"/><path d="M20.7 20.7L28.4 28.4"/>',
  close: '<path d="M7.2 7.2L24.8 24.8M24.8 7.2L7.2 24.8"/>',
  back: '<path d="M26.6 16H5.4M15 6.4L5.4 16L15 25.6"/>',
  compose: '<path d="M17 4.7H9.3C6 4.7 4.4 6.4 4.4 9.7V22.9C4.4 26.2 6 27.8 9.3 27.8H22.4C25.7 27.8 27.3 26.2 27.3 22.9V16.8"/><path d="M13.1 14.8L23.6 4.3Q25.5 2.4 27.4 4.3L28 4.9Q29.9 6.8 28 8.7L17.5 19.2L11.7 20.6Z"/><path d="M21.5 6.4L25.9 10.8"/>',
  user: `${head}<path d="${shoulders}"/>`,
  aiSettings: '<rect x="3.7" y="3.7" width="24.6" height="24.6" rx="5.2"/><path d="M10.7 8.3V11.3M10.7 16.1V23.7M21.3 8.3V16M21.3 20.8V23.7"/><circle cx="10.7" cy="13.7" r="2.4"/><circle cx="21.3" cy="18.4" r="2.4"/>',
  personas: '<circle cx="11.4" cy="9.1" r="5.1"/><path d="M2.9 27.7C3.8 22.3 7 19.3 11.4 19.3S19 22.3 19.9 27.7M22.2 5.2C25 5.2 26.8 7 26.8 9.6S25 14 22.2 14M23.4 19.5C27.1 20.4 29 23.1 29.3 27.7"/>',
  prompt: '<path d="M18.6 3.8H8.4C5.9 3.8 4.7 5.1 4.7 7.6V24.4C4.7 26.9 5.9 28.2 8.4 28.2H23.6C26.1 28.2 27.3 26.9 27.3 24.4V12.5Z"/><path d="M18.6 3.8V9.6Q18.6 12.5 21.5 12.5H27.3M10 18H22M10 23H18.7"/>',
  appearance: '<path d="M26.9 19.1C25.4 24.1 21 27.6 15.7 27.6A11.6 11.6 0 0 1 13.1 4.7C11.9 6.2 11.2 8.2 11.2 10.3C11.2 15.7 15.6 20 21 20C23.1 20 25.1 19.7 26.9 19.1Z"/>',
  language: '<circle cx="16" cy="16" r="12.1"/><ellipse cx="16" cy="16" rx="5.2" ry="12.1"/><path d="M3.9 16H28.1"/>',
  plugin: '<path d="M12.8 6.8H7Q4.4 6.8 4.4 9.4V12.4H6.2A3.6 3.6 0 0 1 6.2 19.6H4.4V25Q4.4 27.6 7 27.6H12.4V25.8A3.6 3.6 0 0 1 19.6 25.8V27.6H25Q27.6 27.6 27.6 25V19.8H26A3.8 3.8 0 0 1 26 12.2H27.6V9.4Q27.6 6.8 25 6.8H19.2V6.2A3.2 3.2 0 0 0 12.8 6.2Z"/>',
  info: '<circle cx="16" cy="16" r="12.1"/><path d="M16 15.3V22.7"/><circle cx="16" cy="9.7" r="1.35" fill="currentColor" stroke="none"/>',
};

function wrapSvg(name, body, weight, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"><title>Promlive ${name}</title>${body}</svg>`;
}
function svgFor(name, size = 44) {
  const art = tabArtwork[name.replace(/Selected$/, '')];
  return wrapSvg(name, icons[name], art?.weight || 2.4, size);
}
function tabLayerSvgFor(name, layer, size = 44) {
  const art = tabArtwork[name];
  return wrapSvg(`${name} ${layer}`, art[layer] || '', art.weight, size);
}

module.exports = {icons, tabArtwork, svgFor, tabLayerSvgFor};
