// Original Promlive artwork. 32-unit grid, open counters, rounded strokes.
// Generate SVG exports and native masks with generate-navigation-icons.cjs.
const home = 'M13.9 4.18Q16 2.5 18.1 4.18L26.35 11.18Q28.5 13.03 28.5 15.9V24.1Q28.5 28.5 24.1 28.5H7.9Q3.5 28.5 3.5 24.1V15.9Q3.5 13.03 5.65 11.18Z';
const bubble = 'M16 3.7C9.2 3.7 3.7 9.18 3.7 15.95S9.2 28.2 16 28.2C18.215 28.2 20.3 27.63 22.11 26.575L28.1 27.9L27.015 21.5C27.875 19.83 28.3 17.965 28.3 15.95C28.3 9.18 22.8 3.7 16 3.7Z';
const plus = 'M16 10V22M10 16H22';

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
  // Approved balanced collection. Personas uses the profile-card variant.
  plus: '<path d="M16 4.5V27.5M4.5 16H27.5"/>',
  listPlus: '<path d="M4.5 7H27.5M4.5 15H17M4.5 23H12.5M24 17V29M18 23H30"/>',
  send: solid('M9.3 6.1C4.2 3.6 2.4 6.3 4.8 10.4L6.3 12.9C6.9 14.1 7.7 14.7 9.4 14.7H20.6C22.7 14.7 22.7 17.3 20.6 17.3H9.4C7.7 17.3 6.9 17.9 6.3 19.1L4.8 21.6C2.4 25.7 4.2 28.4 9.3 25.9L25.8 19.3C30.1 17.8 30.1 14.2 25.8 12.7Z'),
  search: '<circle cx="13.5" cy="13.5" r="9.6"/><path d="M20.6 20.6L28.3 28.3"/>',
  close: '<path d="M7 7L25 25M25 7L7 25"/>',
  check: '<path d="M5 16.5L12.3 23.5L27 8.5"/>',
  back: '<path d="M27 16H5M15 6L5 16L15 26"/>',
  eye: '<path d="M2.8 16C6.4 10 10.7 7 16 7S25.6 10 29.2 16C25.6 22 21.3 25 16 25S6.4 22 2.8 16Z"/><circle cx="16" cy="16" r="4.1"/>',
  eyeOff: '<defs><mask id="eye-off-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="white" stroke="none"/><path d="M4.5 4.5L27.5 27.5" fill="none" stroke="black" stroke-width="6"/></mask></defs><g mask="url(#eye-off-cut)"><path d="M2.8 16C6.4 10 10.7 7 16 7S25.6 10 29.2 16C25.6 22 21.3 25 16 25S6.4 22 2.8 16Z"/><circle cx="16" cy="16" r="4.1"/></g><path d="M4.5 4.5L27.5 27.5"/>',
  more: '<circle cx="16" cy="6.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.9" fill="currentColor" stroke="none"/><circle cx="16" cy="25.5" r="1.9" fill="currentColor" stroke="none"/>',
  compose: '<path d="M17 4.5H9.5Q4.5 4.5 4.5 9.5V22.5Q4.5 27.5 9.5 27.5H22.5Q27.5 27.5 27.5 22.5V16.5M12.8 15.4L23.8 4.4Q25.3 2.9 26.8 4.4L28 5.6Q29.5 7.1 28 8.6L17 19.6L11.5 21ZM21.8 6.4L26 10.6"/>',
  user: '<circle cx="16" cy="16" r="12.3"/><circle cx="16" cy="12.2" r="4.3"/><path d="M6.8 24Q9 19.5 16 19.5Q23 19.5 25.2 24"/>',
  aiSettings: '<rect x="7" y="7" width="18" height="18" rx="4"/><rect x="12" y="12" width="8" height="8" rx="2"/><path d="M12 3V7M20 3V7M12 25V29M20 25V29M3 12H7M3 20H7M25 12H29M25 20H29"/>',
  personas: '<rect x="4.2" y="3.8" width="23.6" height="24.4" rx="5.2"/><circle cx="16" cy="11.5" r="4.2"/><path d="M9 23.5Q10.3 19 16 19Q21.7 19 23 23.5"/>',
  prompt: '<rect x="4.7" y="3.7" width="22.6" height="24.6" rx="5.3"/><path d="M10.5 10.5H21.5M10.5 16H21.5M10.5 21.5H17.5"/>',
  appearance: '<circle cx="16" cy="16" r="6.1"/><path d="M16 2.8V5.5M16 26.5V29.2M2.8 16H5.5M26.5 16H29.2M6.6 6.6L8.5 8.5M23.5 23.5L25.4 25.4M6.6 25.4L8.5 23.5M23.5 8.5L25.4 6.6"/>',
  language: '<path d="M19 11V7Q19 4 16 4H6Q3 4 3 7V17Q3 20 6 20H11M16 12H26Q29 12 29 15V25Q29 28 26 28H16Q13 28 13 25V15Q13 12 16 12Z"/><g stroke-width="1.9"><path d="M6.5 9H15.5M11 6.7V9M13.6 9Q12.6 14.2 7 17M8.8 11Q11.2 14.8 14.5 16M17.2 24L21 16L24.8 24M18.7 21H23.3"/></g>',
  plugin: '<path d="M11 4V11M21 4V11M7 11H25V15Q25 23 16 23Q7 23 7 15ZM16 23V29"/>',
  info: '<circle cx="16" cy="16" r="12.2"/><circle cx="16" cy="9.7" r="1.4" fill="currentColor" stroke="none"/><path d="M16 15V22.7"/>',
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
