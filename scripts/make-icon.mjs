#!/usr/bin/env node
// Generates every Rusteach icon from code (no binary sources to keep in sync):
//
//   build/icon.svg                 the master artwork (1024 × 1024)
//   build/icon.png                 1024 px  (electron-builder, Linux/macOS)
//   build/icon.ico                 16, 24, 32, 48, 64, 128, 256 px (Windows exe, installer, shortcuts)
//   build/installerSidebar.bmp     164 × 314 NSIS welcome/finish page art
//   build/installerHeader.bmp      150 × 57 NSIS inner page header
//   public/icon.png                512 px  (BrowserWindow icon; Vite copies it to dist/)
//
//   when android/ exists (Capacitor):
//   android/.../res/mipmap-*/      adaptive layers (background, foreground, monochrome) + legacy icons
//   android/.../res/drawable-*/splash_icon.png   splash fallback for Android < 12
//   store/icon-512.png, store/feature-graphic.png  Play Store listing art
//
//   node scripts/make-icon.mjs [--preview <file.png>]
//
// Ferris the crab is the Rust community's public-domain mascot. Sizes up to 32 px use a separately
// drawn, pixel-aligned crab: the eye stalks and pincers of the big artwork turn to mush that small.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const PUBLIC = path.join(ROOT, 'public');

// ------------------------------------------------------------------ palette

const C = {
  ember: ['#ffa04f', '#f5651f', '#c93c0a'], // plate gradient: light → dark
  glow: '#ffe0b0',
  shell: ['#fffaf3', '#ffe2c6'], // the crab: warm cream, lit from above
  limb: '#fff0e0',
  ink: '#1a1f2e', // eyes and smile - the app's night-navy
  blush: '#ff8a52',
  shadow: '#7c2300',
  night: ['#141a27', '#0b0e14'], // installer art background (= app --c-bg)
};

// ------------------------------------------------------------------ geometry helpers

const f = (n) => Number(n.toFixed(2));

/** Superellipse ("squircle") path - softer, more even corners than a rounded rect. */
function squircle(x, y, w, h, n = 5, steps = 240) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(`${f(cx + (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n))} ${f(cy + (h / 2) * Math.sign(s) * Math.abs(s) ** (2 / n))}`);
  }
  return `M${pts.join('L')}Z`;
}

/** A pincer: a disc with a wedge cut out, opening towards `dir` (degrees, 0 = right, -90 = up). */
function pincer(cx, cy, r, dir, gap = 54) {
  const a1 = ((dir + gap / 2) * Math.PI) / 180;
  const a2 = ((dir - gap / 2) * Math.PI) / 180;
  const p = (a, rr = r) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  const inner = r * 0.22;
  return `M${p(a1, inner)} L${p(a1)} A${r} ${r} 0 1 1 ${p(a2)} L${p(a2, inner)} Z`;
}

/** The same markup twice: as drawn (left side) and mirrored around x = 512 (right side). */
const bothSides = (markup) => `${markup}<g transform="translate(1024 0) scale(-1 1)">${markup}</g>`;

// ------------------------------------------------------------------ the big artwork (≥ 48 px)

function plateDefs(id, box) {
  const [x, y, w, h] = box;
  return `
    <linearGradient id="${id}-ember" x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.ember[0]}"/>
      <stop offset="0.52" stop-color="${C.ember[1]}"/>
      <stop offset="1" stop-color="${C.ember[2]}"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="${x + w * 0.38}" cy="${y + h * 0.2}" r="${w * 0.72}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.glow}" stop-opacity="0.62"/>
      <stop offset="0.55" stop-color="${C.glow}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${C.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-floor" x1="0" y1="${y}" x2="0" y2="${y + h}" gradientUnits="userSpaceOnUse">
      <stop offset="0.55" stop-color="#5a1500" stop-opacity="0"/>
      <stop offset="1" stop-color="#5a1500" stop-opacity="0.32"/>
    </linearGradient>
    <linearGradient id="${id}-rim" x1="0" y1="${y}" x2="0" y2="${y + h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.8" stop-color="#3d0e00" stop-opacity="0"/>
      <stop offset="1" stop-color="#3d0e00" stop-opacity="0.35"/>
    </linearGradient>`;
}

function plate(id, box, n = 5) {
  const d = squircle(...box, n);
  return `
    <clipPath id="${id}-clip"><path d="${d}"/></clipPath>
    <path d="${d}" fill="url(#${id}-ember)"/>
    <path d="${d}" fill="url(#${id}-glow)"/>
    <path d="${d}" fill="url(#${id}-floor)"/>
    <path d="${d}" fill="none" stroke="url(#${id}-rim)" stroke-width="${f(box[2] * 0.016)}" clip-path="url(#${id}-clip)"/>`;
}

function crabDefs(id) {
  return `
    <linearGradient id="${id}-shell" x1="0" y1="420" x2="0" y2="790" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.shell[0]}"/>
      <stop offset="1" stop-color="${C.shell[1]}"/>
    </linearGradient>
    <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dy="16" result="blur"/>
      <feFlood flood-color="${C.shadow}" flood-opacity="0.5"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

/** Point and outward normal on a cubic Bézier at t. */
function bezierAt([p0, p1, p2, p3], t) {
  const u = 1 - t;
  const pt = (i) => u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t ** 3 * p3[i];
  const d = (i) => 3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i]);
  const len = Math.hypot(d(0), d(1));
  return { x: pt(0), y: pt(1), nx: d(1) / len, ny: -d(0) / len, tx: d(0) / len, ty: d(1) / len };
}

/**
 * Ferris' serrated shell edge: rounded spikes standing on the dome (left half). They sit between the
 * raised arm and the eye stalks, lean upwards a little, and each base is sunk into the shell so it
 * grows out of it seamlessly.
 */
function shellSpikes() {
  const dome = [[252, 676], [252, 560], [366, 500], [512, 500]];
  const spikes = [
    { t: 0.32, half: 30, h: 28 },
    { t: 0.55, half: 32, h: 32 },
    { t: 0.78, half: 26, h: 24 },
  ];
  return spikes
    .map(({ t, half, h }) => {
      const { x, y, nx, ny, tx, ty } = bezierAt(dome, t); // (nx, ny) points out of the shell
      const lean = Math.hypot(nx, ny - 0.7);
      const [ux, uy] = [nx / lean, (ny - 0.7) / lean];
      const sink = 14;
      const a = `${f(x - tx * half - nx * sink)} ${f(y - ty * half - ny * sink)}`;
      const b = `${f(x + tx * half - nx * sink)} ${f(y + ty * half - ny * sink)}`;
      const tip = `${f(x + ux * h)} ${f(y + uy * h)}`;
      return `M${a} L${tip} L${b} Z`;
    })
    .join(' ');
}

/** Ferris, raising both claws - drawn in a 1024 box, centred. */
function crab(id) {
  const limb = `stroke="${C.limb}" stroke-linecap="round" fill="none"`;
  const leftLegs = ['M300 700 Q232 700 206 760', 'M326 734 Q270 752 258 812', 'M368 756 Q328 784 330 836'];
  const leftArm = 'M298 652 Q206 640 208 520';
  const leftClaw = pincer(214, 436, 84, -84, 58);
  return `
  <g filter="url(#${id}-shadow)" transform="translate(0 -46)">
    ${bothSides(`
      <g ${limb} stroke-width="30">${leftLegs.map((d) => `<path d="${d}"/>`).join('')}</g>
      <path d="${leftArm}" ${limb} stroke-width="38"/>
      <path d="${leftClaw}" fill="url(#${id}-shell)"/>
      <path d="${shellSpikes()}" fill="url(#${id}-shell)" stroke="url(#${id}-shell)" stroke-width="26" stroke-linejoin="round"/>`)}
    <g fill="url(#${id}-shell)">
      <path d="M252 676 C252 560 366 500 512 500 C658 500 772 560 772 676 C772 744 698 778 512 778 C326 778 252 744 252 676 Z"/>
    </g>
    <g ${limb} stroke-width="30"><path d="M464 520 L452 420"/><path d="M560 520 L572 420"/></g>
    <g>
      <circle cx="446" cy="392" r="64" fill="#ffffff"/>
      <circle cx="578" cy="392" r="64" fill="#ffffff"/>
      <circle cx="455" cy="400" r="29" fill="${C.ink}"/>
      <circle cx="587" cy="400" r="29" fill="${C.ink}"/>
      <circle cx="465" cy="388" r="10" fill="#ffffff"/>
      <circle cx="597" cy="388" r="10" fill="#ffffff"/>
    </g>
    <ellipse cx="398" cy="664" rx="30" ry="18" fill="${C.blush}" opacity="0.45"/>
    <ellipse cx="626" cy="664" rx="30" ry="18" fill="${C.blush}" opacity="0.45"/>
    <path d="M466 650 Q512 700 558 650" stroke="${C.ink}" stroke-width="16" stroke-linecap="round" fill="none"/>
  </g>`;
}

function iconSvg() {
  const box = [44, 44, 936, 936];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${plateDefs('p', box)}${crabDefs('c')}</defs>
  ${plate('p', box)}
  ${crab('c')}
</svg>`;
}

// ------------------------------------------------------------------ the small artwork (16–32 px)

/** Drawn on a 32 grid; every edge that matters sits on whole (or half) pixels at 16, 24 and 32 px. */
function smallIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="e" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.ember[0]}"/><stop offset="0.55" stop-color="${C.ember[1]}"/><stop offset="1" stop-color="${C.ember[2]}"/>
    </linearGradient>
  </defs>
  <path d="${squircle(0, 0, 32, 32, 4.2)}" fill="url(#e)"/>
  <g stroke="${C.limb}" stroke-linecap="round" fill="none">
    <path d="M9 18 L6.5 12" stroke-width="2.6"/><path d="M23 18 L25.5 12" stroke-width="2.6"/>
    <path d="M8 22 L4.5 25" stroke-width="2"/><path d="M24 22 L27.5 25" stroke-width="2"/>
  </g>
  <path d="${pincer(6.2, 9.4, 4.4, -80, 76)}" fill="${C.shell[0]}"/>
  <path d="${pincer(25.8, 9.4, 4.4, -100, 76)}" fill="${C.shell[0]}"/>
  <path d="M5 21 C5 15.5 9.5 13 16 13 C22.5 13 27 15.5 27 21 C27 25 22.5 26.5 16 26.5 C9.5 26.5 5 25 5 21 Z" fill="${C.shell[0]}"/>
  <rect x="11" y="16.5" width="3.4" height="4" rx="1.7" fill="${C.ink}"/>
  <rect x="17.6" y="16.5" width="3.4" height="4" rx="1.7" fill="${C.ink}"/>
</svg>`;
}

// ------------------------------------------------------------------ installer art

function sidebarSvg() {
  // 164 × 314: night background, a forge glow rising from below, the icon floating in it.
  const s = 0.11; // icon scale (1024 → ~113 px)
  const box = [44, 44, 936, 936];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="314" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.night[0]}"/><stop offset="1" stop-color="${C.night[1]}"/>
    </linearGradient>
    <radialGradient id="forge" cx="82" cy="330" r="190" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff6a1f" stop-opacity="0.75"/>
      <stop offset="0.45" stop-color="#f74c00" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#f74c00" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="82" cy="118" r="88" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff7a2e" stop-opacity="0.35"/><stop offset="1" stop-color="#ff7a2e" stop-opacity="0"/>
    </radialGradient>
    ${plateDefs('sp', box)}${crabDefs('sc')}
  </defs>
  <rect width="164" height="314" fill="url(#bg)"/>
  <rect width="164" height="314" fill="url(#forge)"/>
  <circle cx="82" cy="118" r="88" fill="url(#halo)"/>
  ${[
    [30, 232, 1.6, 0.8],
    [126, 214, 1.2, 0.6],
    [104, 262, 1.8, 0.7],
    [52, 280, 1.1, 0.5],
    [140, 268, 1, 0.45],
    [18, 196, 0.9, 0.4],
  ]
    .map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffb27a" opacity="${o}"/>`)
    .join('')}
  <g transform="translate(${f(82 - 512 * s)} ${f(118 - 512 * s)}) scale(${s})">
    ${plate('sp', box)}${crab('sc')}
  </g>
</svg>`;
}

function headerSvg() {
  // 150 × 57, shown at the top right of the installer's inner pages (white background).
  const s = 0.047;
  const box = [44, 44, 936, 936];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
  <defs>${plateDefs('hp', box)}${crabDefs('hc')}</defs>
  <rect width="150" height="57" fill="#ffffff"/>
  <g transform="translate(${f(122 - 512 * s)} ${f(28.5 - 512 * s)}) scale(${s})">${plate('hp', box)}${crab('hc')}</g>
</svg>`;
}

// ------------------------------------------------------------------ Android / Play Store art

// Ferris' bounding box in the 1024 artwork (claw tips to leg ends, after the -46 lift), centre y 548.
const CRAB_CY = 548;

/** Adaptive icon background: the ember plate, full bleed (the launcher applies its own mask). */
function adaptiveBackgroundSvg() {
  const box = [0, 0, 1024, 1024];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${plateDefs('b', box)}</defs>
  <rect width="1024" height="1024" fill="url(#b-ember)"/>
  <rect width="1024" height="1024" fill="url(#b-glow)"/>
  <rect width="1024" height="1024" fill="url(#b-floor)"/>
</svg>`;
}

/** Ferris alone, shrunk into the adaptive icon's 66/108 safe circle. */
function adaptiveForegroundSvg(scale = 0.64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${crabDefs('c')}</defs>
  <g transform="translate(${f(512 - 512 * scale)} ${f(512 - CRAB_CY * scale)}) scale(${scale})">${crab('c')}</g>
</svg>`;
}

/** Pre-Oreo round launcher icon: a full ember disc. */
function roundIconSvg() {
  const box = [0, 0, 1024, 1024];
  const s = 0.8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${plateDefs('r', box)}${crabDefs('c')}</defs>
  <circle cx="512" cy="512" r="488" fill="url(#r-ember)"/>
  <circle cx="512" cy="512" r="488" fill="url(#r-glow)"/>
  <circle cx="512" cy="512" r="488" fill="url(#r-floor)"/>
  <g transform="translate(${f(512 - 512 * s)} ${f(512 - CRAB_CY * s)}) scale(${s})">${crab('c')}</g>
</svg>`;
}

/** Play Store feature graphic (1024 × 500): night background, forge glow, icon and wordmark. */
function featureGraphicSvg() {
  const s = 0.34;
  const box = [44, 44, 936, 936];
  const ix = 120;
  const iy = 250 - 512 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.night[0]}"/><stop offset="1" stop-color="${C.night[1]}"/>
    </linearGradient>
    <radialGradient id="forge" cx="294" cy="250" r="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff6a1f" stop-opacity="0.42"/>
      <stop offset="0.5" stop-color="#f74c00" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#f74c00" stop-opacity="0"/>
    </radialGradient>
    ${plateDefs('fp', box)}${crabDefs('fc')}
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <rect width="1024" height="500" fill="url(#forge)"/>
  <g transform="translate(${f(ix)} ${f(iy)}) scale(${s})">${plate('fp', box)}${crab('fc')}</g>
  <g font-family="Segoe UI, Inter, Arial, sans-serif">
    <text x="520" y="236" font-size="96" font-weight="800" fill="#f4f1ec" letter-spacing="-2">Rusteach</text>
    <text x="524" y="300" font-size="36" font-weight="500" fill="#ffb27a">Türkçe Rust kursu</text>
    <text x="524" y="350" font-size="26" font-weight="400" fill="#9aa3b5">Dersler, alıştırmalar, canlı kod</text>
  </g>
</svg>`;
}

/** White silhouette for Android 13 themed icons: keeps bright pixels, drops ink and shadow. */
async function monochrome(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const keep = Math.min(1, Math.max(0, (lum - 0.45) / 0.2));
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(data[i + 3] * keep);
  }
  return sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function androidAssets(res) {
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  const bg = adaptiveBackgroundSvg();
  const fg = adaptiveForegroundSvg();
  const square = iconSvg();
  const round = roundIconSvg();
  for (const [name, d] of Object.entries(DENSITIES)) {
    const dir = path.join(res, `mipmap-${name}`);
    fs.mkdirSync(dir, { recursive: true });
    const layer = Math.round(108 * d);
    fs.writeFileSync(path.join(dir, 'ic_launcher_background.png'), await render(bg, layer));
    const fgPng = await render(fg, layer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), fgPng);
    fs.writeFileSync(path.join(dir, 'ic_launcher_monochrome.png'), await monochrome(fgPng));
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await render(square, Math.round(48 * d)));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await render(round, Math.round(48 * d)));
    // splash fallback for Android < 12: the icon centred on the night background (drawable/splash.xml)
    const sdir = path.join(res, `drawable-${name}`);
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, 'splash_icon.png'), await render(square, Math.round(112 * d)));
  }
  fs.mkdirSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
  fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
  fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
  return { fg, bg };
}

// ------------------------------------------------------------------ rendering

const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: (72 * size) / Number(/width="(\d+)"/.exec(svg)[1]) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/** 24-bit bottom-up BMP (what NSIS expects; sharp cannot write BMP). */
async function bmp(svg, width, height) {
  const { data } = await sharp(Buffer.from(svg)).flatten({ background: '#0b0e14' }).raw().toBuffer({ resolveWithObject: true });
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + rowSize * height);
  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(rowSize * height, 34);
  out.writeInt32LE(2835, 38);
  out.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      out[row + x * 3] = data[i + 2];
      out[row + x * 3 + 1] = data[i + 1];
      out[row + x * 3 + 2] = data[i];
    }
  }
  return out;
}

/** Contact sheet of every size on dark and light backgrounds (pixel-doubled small sizes). */
async function preview(file, icons) {
  const cell = 280;
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const backgrounds = ['#0b0e14', '#f6f4f1'];
  const comps = backgrounds.map((bg, row) => ({
    input: { create: { width: 1200, height: cell, channels: 4, background: bg } },
    left: 0,
    top: row * cell,
  }));
  for (let row = 0; row < backgrounds.length; row++) {
    let x = 16;
    for (const size of sizes) {
      const zoom = size <= 32 ? 4 : size <= 64 ? 2 : 1;
      const img = await sharp(icons[size]).resize(size * zoom, size * zoom, { kernel: 'nearest' }).png().toBuffer();
      comps.push({ input: img, left: x, top: row * cell + Math.round((cell - size * zoom) / 2) });
      x += size * zoom + 24;
    }
  }
  await sharp({ create: { width: 1200, height: cell * 2, channels: 4, background: '#000000' } })
    .composite(comps)
    .png()
    .toFile(file);
}

// ------------------------------------------------------------------ main

fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(PUBLIC, { recursive: true });

const master = iconSvg();
const small = smallIconSvg();
fs.writeFileSync(path.join(BUILD, 'icon.svg'), master);

const icons = {};
for (const size of [16, 24, 32]) icons[size] = await render(small, size);
for (const size of [48, 64, 128, 256, 512, 1024]) icons[size] = await render(master, size);

fs.writeFileSync(path.join(BUILD, 'icon.png'), icons[1024]);
fs.writeFileSync(path.join(PUBLIC, 'icon.png'), icons[512]);
fs.writeFileSync(path.join(BUILD, 'icon.ico'), await pngToIco([16, 24, 32, 48, 64, 128, 256].map((s) => icons[s])));
fs.writeFileSync(path.join(BUILD, 'installerSidebar.bmp'), await bmp(sidebarSvg(), 164, 314));
fs.writeFileSync(path.join(BUILD, 'installerHeader.bmp'), await bmp(headerSvg(), 150, 57));

const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const STORE = path.join(ROOT, 'store');
let android = null;
if (fs.existsSync(ANDROID_RES)) {
  android = await androidAssets(ANDROID_RES);
  fs.mkdirSync(STORE, { recursive: true });
  fs.writeFileSync(path.join(STORE, 'icon-512.png'), icons[512]);
  await sharp(Buffer.from(featureGraphicSvg())).flatten({ background: C.night[1] }).png().toFile(path.join(STORE, 'feature-graphic.png'));
  console.log('Android simgeleri: android/app/src/main/res/mipmap-*, store/icon-512.png, store/feature-graphic.png');
}

const previewArg = process.argv.indexOf('--preview');
if (previewArg > 0 && process.argv[previewArg + 1]) {
  const out = path.resolve(process.argv[previewArg + 1]);
  await preview(out, icons);
  if (android) {
    // the adaptive icon under the masks launchers use: circle, squircle, rounded square
    const layer = 432;
    const bgPng = await render(android.bg, layer);
    const fgPng = await render(android.fg, layer);
    const full = await sharp(bgPng).composite([{ input: fgPng }]).png().toBuffer();
    const inset = Math.round((layer * 18) / 108); // launchers show the middle 72 of 108
    const visible = await sharp(full).extract({ left: inset, top: inset, width: layer - 2 * inset, height: layer - 2 * inset }).png().toBuffer();
    const v = layer - 2 * inset;
    const masks = [
      `<circle cx="${v / 2}" cy="${v / 2}" r="${v / 2}"/>`,
      `<path d="${squircle(0, 0, v, v, 4)}"/>`,
      `<rect width="${v}" height="${v}" rx="${v * 0.2}"/>`,
    ];
    const tiles = await Promise.all(
      masks.map((m) =>
        sharp(visible)
          .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${v}" height="${v}">${m}</svg>`), blend: 'dest-in' }])
          .png()
          .toBuffer(),
      ),
    );
    const mono = await monochrome(fgPng);
    await sharp({ create: { width: v * 4 + 100, height: v + 40, channels: 4, background: '#2a2f3a' } })
      .composite([...tiles.map((t, i) => ({ input: t, left: 20 + i * (v + 20), top: 20 })), { input: await sharp(mono).extract({ left: inset, top: inset, width: v, height: v }).png().toBuffer(), left: 20 + 3 * (v + 20), top: 20 }])
      .png()
      .toFile(out.replace(/\.png$/, '-android.png'));
  }
  await sharp(Buffer.from(sidebarSvg())).resize(164 * 2, 314 * 2, { kernel: 'nearest' }).png().toFile(out.replace(/\.png$/, '-sidebar.png'));
  await sharp(Buffer.from(headerSvg())).resize(300, 114, { kernel: 'nearest' }).png().toFile(out.replace(/\.png$/, '-header.png'));
  console.log(`önizleme: ${out}`);
}

console.log('Simgeler üretildi: build/icon.svg, build/icon.png, build/icon.ico, build/installerSidebar.bmp, build/installerHeader.bmp, public/icon.png');
