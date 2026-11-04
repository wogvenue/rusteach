#!/usr/bin/env node
// Installs the packaged Linux build for the current user only (no root needed):
//   release/linux-unpacked -> ~/.local/opt/rusteach
//   ~/.local/bin/rusteach, a menu entry and its icon.
// Run through `npm run install:linux`, which packs first. `--uninstall` removes all of it
// (progress in ~/.config/Rusteach stays).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'release', 'linux-unpacked');
const LOCAL = path.join(os.homedir(), '.local');
const APP_DIR = path.join(LOCAL, 'opt', 'rusteach');
const BIN = path.join(LOCAL, 'bin', 'rusteach');
const DESKTOP = path.join(LOCAL, 'share', 'applications', 'rusteach.desktop');
const ICON = path.join(LOCAL, 'share', 'icons', 'hicolor', '512x512', 'apps', 'rusteach.png');

function uninstall() {
  for (const p of [APP_DIR, BIN, DESKTOP, ICON]) fs.rmSync(p, { recursive: true, force: true });
}

if (process.argv.includes('--uninstall')) {
  uninstall();
  console.log('Rusteach kaldırıldı.');
  process.exit(0);
}

if (!fs.existsSync(path.join(SRC, 'rusteach'))) {
  console.error(`${SRC} bulunamadı. Önce: npm run pack:linux`);
  process.exit(1);
}

uninstall();
fs.mkdirSync(path.dirname(APP_DIR), { recursive: true });
fs.cpSync(SRC, APP_DIR, { recursive: true, verbatimSymlinks: true });

fs.mkdirSync(path.dirname(BIN), { recursive: true });
fs.symlinkSync(path.join(APP_DIR, 'rusteach'), BIN);

fs.mkdirSync(path.dirname(ICON), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'build', 'icon.png'), ICON);

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
fs.mkdirSync(path.dirname(DESKTOP), { recursive: true });
fs.writeFileSync(
  DESKTOP,
  [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Rusteach',
    'Comment=Sıfırdan uzmanlığa Rust öğreten etkileşimli uygulama',
    `Exec="${path.join(APP_DIR, 'rusteach')}" %U`,
    `Icon=${ICON}`,
    'Terminal=false',
    'Categories=Education;Development;',
    'StartupWMClass=Rusteach',
    `X-AppVersion=${version}`,
    '',
  ].join('\n'),
);

console.log(`Rusteach ${version} kuruldu: ${APP_DIR}`);
console.log('Uygulama menüsünden ya da terminalde `rusteach` ile açabilirsin.');
