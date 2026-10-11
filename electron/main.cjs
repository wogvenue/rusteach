// Rusteach - Electron main process (CommonJS; package.json is "type": "module").
//
//   electron .                          production renderer from dist/ (run `npm run build` first)
//   ELECTRON_DEV_URL=http://… electron . development: load the Vite dev server (npm run dev)
//   electron . --smoke-test             load dist/, wait for did-finish-load + 3 s, print renderer errors, exit 0/1
//   electron . --smoke-test --smoke-run   …and also run a hello-world program through window.rusteach
//   electron . --smoke-test --smoke-routes …and also visit every screen, the first module and a lesson
'use strict';

const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, net, screen, session, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { createRunner } = require('./runner.cjs');

const ROOT = path.join(__dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');
const SMOKE = process.argv.includes('--smoke-test');
const SMOKE_RUN = process.argv.includes('--smoke-run');
const SMOKE_ROUTES = process.argv.includes('--smoke-routes');
const DEV_URL = SMOKE ? null : process.env.ELECTRON_DEV_URL || null;
const IS_DEV = !app.isPackaged;
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

// The renderer's top bar (src/components/layout/TopBar.tsx) is 48 CSS px tall including its 1 px
// bottom border. The Windows caption buttons fill the bar above that border at every zoom level.
const TOP_BAR_HEIGHT = 48;
const DEFAULT_SIZE = { width: 1360, height: 880 };
const MIN_SIZE = { width: 1024, height: 700 };
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen']);

// Window chrome per theme. `background` = --c-bg of src/index.css: the native window color, so
// there is never a white flash before the first paint.
const THEMES = {
  dark: { background: '#0b0e14', symbols: '#c3cad8' },
  light: { background: '#f6f4f1', symbols: '#3f3a36' },
};

if (SMOKE) {
  // Never touch the learner's real progress or window state, and allow running next to the app.
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'rusteach-smoke-')));
}
if (DEV_URL) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'; // Vite's dev client needs inline scripts
app.commandLine.appendSwitch('lang', 'tr-TR');

let mainWindow = null;
let runner = null;

// ------------------------------------------------------------------ window state (bounds, theme, zoom)

let windowState = {};
let saveTimer = null;
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (parsed && typeof parsed === 'object') windowState = parsed;
  } catch {
    windowState = {};
  }
}

function saveWindowState(immediately = false) {
  if (SMOKE) return;
  clearTimeout(saveTimer);
  const write = () => {
    try {
      const file = stateFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(windowState, null, 2));
      fs.renameSync(`${file}.tmp`, file);
    } catch (err) {
      console.error('[rusteach] pencere durumu kaydedilemedi:', err.message);
    }
  };
  if (immediately) write();
  else saveTimer = setTimeout(write, 500);
}

function captureBounds(win) {
  if (!win || win.isDestroyed()) return;
  windowState.maximized = win.isMaximized();
  if (!win.isMinimized() && !win.isFullScreen()) windowState.bounds = win.getNormalBounds();
}

/** Saved bounds when their title bar is still reachable on some display, else a centered default. */
function initialBounds(minWidth, minHeight) {
  const area = screen.getPrimaryDisplay().workArea;
  const fallback = { width: Math.min(DEFAULT_SIZE.width, area.width), height: Math.min(DEFAULT_SIZE.height, area.height) };
  const b = windowState.bounds;
  if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) return fallback;
  const width = Math.max(minWidth, Math.round(b.width));
  const height = Math.max(minHeight, Math.round(b.height));
  const reachable = screen.getAllDisplays().some(({ workArea: a }) => {
    const w = Math.min(b.x + width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + TOP_BAR_HEIGHT, a.y + a.height) - Math.max(b.y, a.y);
    return w >= 160 && h >= 24;
  });
  if (!reachable) return { width: Math.min(width, area.width), height: Math.min(height, area.height) };
  return { x: Math.round(b.x), y: Math.round(b.y), width, height };
}

const savedTheme = () => (windowState.theme === 'light' ? 'light' : 'dark');
// The caption buttons are drawn over the renderer's own top bar with a fully transparent
// background, so whatever the page paints there (the bar, a dimmed modal backdrop) shows through
// unchanged. The transparent color keeps the theme's RGB: Electron derives the hover tint from it
// (light tint on dark, dark tint on light).
const overlayFor = (theme, zoom) => ({
  color: `${THEMES[theme].background}00`,
  symbolColor: THEMES[theme].symbols,
  height: Math.max(24, Math.round((TOP_BAR_HEIGHT - 1) * zoom)),
});

function updateOverlay(win) {
  if (IS_MAC || !win || win.isDestroyed()) return;
  try {
    win.setTitleBarOverlay(overlayFor(savedTheme(), win.webContents.getZoomFactor()));
  } catch {
    /* window created without an overlay */
  }
}

function applyTheme(win, theme) {
  if (!win || win.isDestroyed()) return;
  const changed = windowState.theme !== theme;
  windowState.theme = theme;
  win.setBackgroundColor(THEMES[theme].background);
  updateOverlay(win);
  if (changed) saveWindowState();
}

function clampZoom(z) {
  return Number.isFinite(z) ? Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], z)) : 1;
}

function stepZoom(contents, direction) {
  const current = contents.getZoomFactor();
  let next = 1;
  if (direction > 0) next = ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  if (direction < 0) next = [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? ZOOM_STEPS[0];
  contents.setZoomFactor(next);
  updateOverlay(BrowserWindow.fromWebContents(contents));
  windowState.zoom = next;
  saveWindowState();
}

// ------------------------------------------------------------------ URLs

function isWebUrl(raw) {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const samePath = (a, b) => (IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b);

/** The renderer itself: the Vite dev server origin, or dist/index.html (any #/route). */
function isAppUrl(raw) {
  try {
    const u = new URL(String(raw));
    if (DEV_URL) return u.origin === new URL(DEV_URL).origin;
    return u.protocol === 'file:' && samePath(path.resolve(fileURLToPath(u)), path.resolve(DIST_INDEX));
  } catch {
    return false;
  }
}

function openInBrowser(url) {
  if (isWebUrl(url)) shell.openExternal(url).catch(() => {});
}

// ------------------------------------------------------------------ window

function appIcon() {
  for (const p of [path.join(ROOT, 'dist', 'icon.png'), path.join(ROOT, 'public', 'icon.png'), path.join(ROOT, 'build', 'icon.png')]) {
    try {
      const img = nativeImage.createFromBuffer(fs.readFileSync(p)); // readFileSync understands app.asar
      if (!img.isEmpty()) return img;
    } catch {
      /* try the next one */
    }
  }
  return undefined;
}

function createMainWindow({ beforeLoad } = {}) {
  const theme = savedTheme();
  const zoom = clampZoom(Number(windowState.zoom ?? 1));
  const area = screen.getPrimaryDisplay().workArea;
  const minWidth = Math.min(MIN_SIZE.width, area.width);
  const minHeight = Math.min(MIN_SIZE.height, area.height);

  const win = new BrowserWindow({
    ...initialBounds(minWidth, minHeight),
    minWidth,
    minHeight,
    show: false,
    title: 'Rusteach',
    icon: appIcon(),
    backgroundColor: THEMES[theme].background,
    titleBarStyle: 'hidden',
    ...(IS_MAC ? { trafficLightPosition: { x: 16, y: 16 } } : { titleBarOverlay: overlayFor(theme, zoom) }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false, // Turkish prose + Rust identifiers: an English dictionary would underline everything
      devTools: IS_DEV,
      zoomFactor: zoom,
      additionalArguments: [`--rusteach-theme=${theme}`, `--rusteach-version=${app.getVersion()}`],
    },
  });
  const contents = win.webContents;

  win.once('ready-to-show', () => {
    if (SMOKE) return;
    if (windowState.maximized) win.maximize(); // also shows the window
    else win.show();
    win.focus();
  });
  // Safety net: never leave the learner without a window if the first paint never arrives.
  setTimeout(() => {
    if (!SMOKE && !win.isDestroyed() && !win.isVisible()) win.show();
  }, 8000);

  if (!SMOKE) {
    for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) {
      win.on(ev, () => {
        captureBounds(win);
        saveWindowState();
      });
    }
    win.on('close', () => {
      captureBounds(win);
      saveWindowState(true);
    });
  }

  // External links open in the system browser; the app never navigates away from itself.
  contents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, legacyUrl) => {
    const url = event.url ?? legacyUrl;
    if (isAppUrl(url)) return;
    event.preventDefault();
    openInBrowser(url);
  });

  // The default menu is gone; keep the shortcuts people expect from a desktop app.
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = IS_MAC ? input.meta : input.control;
    const key = input.key ?? '';
    let handled = true;
    if (key === 'F11' && !mod && !input.alt && !input.shift) win.setFullScreen(!win.isFullScreen());
    else if (mod && !input.alt && (key === '=' || key === '+' || input.code === 'NumpadAdd')) stepZoom(contents, 1);
    else if (mod && !input.alt && (key === '-' || key === '_' || input.code === 'NumpadSubtract')) stepZoom(contents, -1);
    else if (mod && !input.alt && !input.shift && (key === '0' || input.code === 'Numpad0')) stepZoom(contents, 0);
    else if (IS_DEV && ((mod && input.shift && key.toUpperCase() === 'I') || key === 'F12')) contents.toggleDevTools();
    else if (IS_DEV && ((mod && !input.shift && key.toUpperCase() === 'R') || key === 'F5')) contents.reload();
    else handled = false;
    if (handled) event.preventDefault();
  });
  contents.on('zoom-changed', (_event, direction) => stepZoom(contents, direction === 'in' ? 1 : -1)); // Ctrl + wheel

  contents.on('context-menu', (_event, params) => showContextMenu(win, params));

  let lastCrash = 0;
  contents.on('render-process-gone', (_event, details) => {
    if (SMOKE || details.reason === 'clean-exit' || win.isDestroyed()) return;
    if (Date.now() - lastCrash > 30_000) {
      lastCrash = Date.now();
      contents.reload();
      return;
    }
    dialog
      .showMessageBox(win, {
        type: 'error',
        title: 'Rusteach',
        message: 'Rusteach beklenmedik bir şekilde durdu.',
        detail: 'İlerlemen kayıtlı. Uygulamayı yeniden yüklemeyi dene.',
        buttons: ['Yeniden yükle', 'Kapat'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => (response === 0 ? contents.reload() : app.quit()));
  });

  beforeLoad?.(win);
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(DIST_INDEX);
  return win;
}

function showContextMenu(win, params) {
  const flags = params.editFlags;
  const items = [];
  if (params.linkURL && isWebUrl(params.linkURL)) {
    items.push(
      { label: 'Bağlantıyı tarayıcıda aç', click: () => openInBrowser(params.linkURL) },
      { label: 'Bağlantı adresini kopyala', click: () => clipboard.writeText(params.linkURL) },
    );
  }
  if (params.isEditable) {
    if (items.length) items.push({ type: 'separator' });
    items.push(
      { label: 'Geri al', role: 'undo', enabled: flags.canUndo },
      { label: 'Yinele', role: 'redo', enabled: flags.canRedo },
      { type: 'separator' },
      { label: 'Kes', role: 'cut', enabled: flags.canCut },
      { label: 'Kopyala', role: 'copy', enabled: flags.canCopy },
      { label: 'Yapıştır', role: 'paste', enabled: flags.canPaste },
      { type: 'separator' },
      { label: 'Tümünü seç', role: 'selectAll', enabled: flags.canSelectAll },
    );
  } else if (params.selectionText && params.selectionText.trim()) {
    if (items.length) items.push({ type: 'separator' });
    items.push({ label: 'Kopyala', role: 'copy', enabled: flags.canCopy });
  }
  if (IS_DEV) {
    if (items.length) items.push({ type: 'separator' });
    items.push({ label: 'Öğeyi incele', click: () => win.webContents.inspectElement(params.x, params.y) });
  }
  if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
}

function macMenu() {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'resetZoom', label: 'Gerçek boyut' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam ekran' },
        ...(IS_DEV ? [{ role: 'toggleDevTools' }] : []),
      ],
    },
    { role: 'windowMenu' },
  ]);
}

// ------------------------------------------------------------------ IPC (window.rusteach)

/** Only the app's own page may use the bridge. */
function trusted(event) {
  const frame = event.senderFrame;
  return !!frame && isAppUrl(frame.url);
}

const FILE_TYPES = {
  json: { name: 'JSON dosyası', extensions: ['json'] },
  rs: { name: 'Rust kaynak dosyası', extensions: ['rs'] },
  md: { name: 'Markdown belgesi', extensions: ['md'] },
  txt: { name: 'Metin dosyası', extensions: ['txt'] },
  toml: { name: 'TOML dosyası', extensions: ['toml'] },
};
const ALL_FILES = { name: 'Tüm dosyalar', extensions: ['*'] };
const MAX_OPEN_BYTES = 20 * 1024 * 1024;

const safeFileName = (name) =>
  String(name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);

async function saveTextFile(win, payload) {
  const name = safeFileName(payload?.defaultName) || 'rusteach.txt';
  const content = typeof payload?.content === 'string' ? payload.content : '';
  const ext = path.extname(name).slice(1).toLowerCase();
  const type = FILE_TYPES[ext] ?? (ext ? { name: `${ext.toUpperCase()} dosyası`, extensions: [ext] } : null);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Dosyayı kaydet',
    buttonLabel: 'Kaydet',
    defaultPath: path.join(app.getPath('documents'), name),
    filters: type ? [type, ALL_FILES] : [ALL_FILES],
  });
  if (canceled || !filePath) return false;
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return true;
  } catch (err) {
    dialog.showErrorBox('Dosya kaydedilemedi', `${filePath}\n\n${err.message}`);
    return false;
  }
}

async function openTextFile(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Dosya aç',
    buttonLabel: 'Aç',
    defaultPath: app.getPath('documents'),
    properties: ['openFile'],
    filters: [{ name: 'Desteklenen dosyalar', extensions: ['json', 'rs', 'txt', 'md', 'toml'] }, ALL_FILES],
  });
  const file = !canceled && filePaths?.[0];
  if (!file) return null;
  try {
    const { size } = await fs.promises.stat(file);
    if (size > MAX_OPEN_BYTES) {
      dialog.showErrorBox('Dosya açılamadı', `${file}\n\nDosya çok büyük (en fazla 20 MB açılabilir).`);
      return null;
    }
    return (await fs.promises.readFile(file, 'utf8')).replace(/^﻿/, '');
  } catch (err) {
    dialog.showErrorBox('Dosya açılamadı', `${file}\n\n${err.message}`);
    return null;
  }
}

function registerIpc() {
  const guarded = (fn) => (event, ...args) => {
    if (!trusted(event)) throw new Error('Rusteach: yetkisiz istek reddedildi.');
    return fn(event, ...args);
  };

  ipcMain.handle(
    'rust:run',
    guarded(async (_event, req) => {
      try {
        return await runner.run(req);
      } catch (err) {
        console.error('[rusteach] run failed:', err);
        return {
          ok: false, stdout: '', stderr: '', compileError: false, timedOut: false, durationMs: 0,
          backend: req?.backend === 'online' ? 'online' : 'local',
          infraError: `Kod çalıştırılırken beklenmeyen bir hata oluştu: ${err.message}`,
        };
      }
    }),
  );
  ipcMain.handle(
    'rust:toolchain',
    guarded(async () => {
      const tc = await runner.toolchain({ refresh: true }); // "Tekrar kontrol et" must see a fresh rustup install
      return { rustc: tc.rustc, cargo: tc.cargo };
    }),
  );
  ipcMain.handle(
    'shell:openExternal',
    guarded(async (_event, url) => {
      if (isWebUrl(url)) await shell.openExternal(String(url));
    }),
  );
  ipcMain.handle('file:save', guarded((event, payload) => saveTextFile(BrowserWindow.fromWebContents(event.sender), payload)));
  ipcMain.handle('file:open', guarded((event) => openTextFile(BrowserWindow.fromWebContents(event.sender))));
  ipcMain.on('titlebar:theme', (event, theme) => {
    if (!trusted(event)) return;
    applyTheme(BrowserWindow.fromWebContents(event.sender), theme === 'light' ? 'light' : 'dark');
  });
}

// ------------------------------------------------------------------ smoke test

function attachSmokeTest(win) {
  const contents = win.webContents;
  const consoleErrors = [];
  const problems = [];
  const log = (line) => process.stdout.write(`[smoke] ${line}\n`);
  let finished = false;

  const finish = (problem) => {
    if (finished) return;
    finished = true;
    if (problem) problems.push(problem);
    const all = [...consoleErrors.map((e) => `konsol hatası: ${e}`), ...problems];
    for (const p of all) log(`✗ ${p}`);
    log(all.length ? `BAŞARISIZ (${all.length} sorun)` : 'BAŞARILI, renderer hatasız yüklendi');
    const userData = app.getPath('userData');
    if (!win.isDestroyed()) win.destroy();
    setTimeout(() => {
      try {
        fs.rmSync(userData, { recursive: true, force: true, maxRetries: 2 });
      } catch {
        /* Chromium may still hold a few files; the OS temp cleanup takes them */
      }
      app.exit(all.length ? 1 : 0);
    }, 200);
  };

  let route = '#/';
  contents.on('console-message', (details) => {
    if (details.level === 'error') consoleErrors.push(`[${route}] ${details.message} (${details.sourceId}:${details.lineNumber})`);
  });

  /** --smoke-routes: visits every screen (plus the first module and lesson found on the map). */
  const visitRoutes = async () => {
    const go = async (hash, waitMs = 1200) => {
      route = hash;
      await contents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}; 1`, true);
      await new Promise((r) => setTimeout(r, waitMs));
      return contents.executeJavaScript(
        `(() => ({ main: (document.querySelector('main, #root')?.innerText || '').trim().length,
                   modules: [...document.querySelectorAll('a[href^="#/modul/"]')].map((a) => a.getAttribute('href')),
                   lessons: [...document.querySelectorAll('a[href^="#/ders/"]')].map((a) => a.getAttribute('href')) }))()`,
        true,
      );
    };
    const screens = ['#/harita', '#/tekrar', '#/antrenman', '#/istatistik', '#/profil', '#/sozluk', '#/oyun-alani', '#/ayarlar'];
    let moduleHref = null;
    let lessonHref = null;
    for (const hash of screens) {
      const seen = await go(hash);
      moduleHref ??= seen.modules[0] ?? null;
      lessonHref ??= seen.lessons[0] ?? null;
      log(`ekran ${hash}: ${seen.main ? 'çizildi' : 'BOŞ'}`);
      if (!seen.main) problems.push(`${hash} ekranı boş kaldı`);
    }
    if (moduleHref) {
      const seen = await go(moduleHref);
      lessonHref = seen.lessons[0] ?? lessonHref;
      log(`ekran ${moduleHref}: ${seen.main ? 'çizildi' : 'BOŞ'}`);
    }
    if (lessonHref) {
      const seen = await go(lessonHref, 2000);
      log(`ekran ${lessonHref}: ${seen.main ? 'çizildi' : 'BOŞ'}`);
      if (!seen.main) problems.push(`${lessonHref} ekranı boş kaldı`);
    }
    await go('#/', 800);
  };
  contents.on('preload-error', (_event, _preloadPath, error) => problems.push(`preload hatası: ${error.message}`));
  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) finish(`sayfa yüklenemedi: ${description} (${code}) ${url}`);
  });
  contents.on('render-process-gone', (_event, details) => finish(`renderer süreci kapandı: ${details.reason}`));
  const hardTimeout = setTimeout(() => finish('zaman aşımı: sayfa 45 saniyede yüklenmedi'), 45_000);

  contents.once('did-finish-load', () => {
    log(`yüklendi: ${contents.getURL()}`);
    setTimeout(async () => {
      clearTimeout(hardTimeout);
      const checksTimeout = setTimeout(() => finish('zaman aşımı: denetimler 120 saniyede bitmedi'), 120_000);
      try {
        const info = await contents.executeJavaScript(
          `(() => ({
            title: document.title,
            theme: document.documentElement.dataset.theme,
            rendered: document.getElementById('root')?.childElementCount ?? 0,
            text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 90),
            bridge: window.rusteach ? Object.keys(window.rusteach).sort() : null,
            isElectron: window.rusteach?.isElectron === true,
            platform: window.rusteach?.platform,
            appVersion: window.rusteach?.appVersion,
          }))()`,
          true,
        );
        log(`başlık: ${info.title} · tema: ${info.theme} · sürüm: ${info.appVersion} · platform: ${info.platform}`);
        log(`ekrandaki metin: ${info.text || '(boş)'}`);
        if (!info.rendered) problems.push('React kökü boş: #root içine hiçbir şey çizilmedi');
        const expected = ['appVersion', 'isElectron', 'openExternal', 'openTextFile', 'platform', 'run', 'saveTextFile', 'setTitleBarTheme', 'toolchain'];
        const missing = expected.filter((k) => !info.bridge?.includes(k));
        if (missing.length || !info.isElectron) problems.push(`window.rusteach eksik: ${missing.join(', ') || 'isElectron'}`);

        const tc = await contents.executeJavaScript('window.rusteach.toolchain()', true);
        log(`yerel Rust: rustc=${tc.rustc ?? 'yok'} · cargo=${tc.cargo ?? 'yok'}`);

        if (SMOKE_RUN) {
          const r = await contents.executeJavaScript(
            `window.rusteach.run({ code: 'fn main() {\\n    println!("Merhaba, Rusteach!");\\n}\\n', mode: 'run', backend: 'auto' })`,
            true,
          );
          log(`örnek program (${r.backend}, ${r.durationMs} ms): ok=${r.ok} stdout=${JSON.stringify(r.stdout)}${r.infraError ? ` hata=${r.infraError}` : ''}`);
          if (!r.ok || r.stdout !== 'Merhaba, Rusteach!\n') problems.push('örnek program beklenen çıktıyı vermedi');
        }
        if (SMOKE_ROUTES) await visitRoutes();
      } catch (err) {
        problems.push(`denetim çalıştırılamadı: ${err.message}`);
      }
      clearTimeout(checksTimeout);
      finish();
    }, 3000);
  });
}

// ------------------------------------------------------------------ app lifecycle

function sandboxDir() {
  // The cargo sandbox grows to hundreds of MB: keep it out of the roaming profile on Windows.
  const base = IS_WIN && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Rusteach') : app.getPath('userData');
  return path.join(base, 'rust-sandbox');
}

function boot() {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      openInBrowser(url);
      return { action: 'deny' };
    });
  });

  app.whenReady().then(() => {
    if (IS_WIN) app.setAppUserModelId('com.rusteach.app');
    Menu.setApplicationMenu(IS_MAC ? macMenu() : null);
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));

    runner = createRunner({
      tempDir: path.join(app.getPath('temp'), 'Rusteach'),
      sandboxDir: sandboxDir(),
      fetch: (url, init) => net.fetch(url, init), // Chromium network stack: honours the system proxy
      log: (...args) => IS_DEV && console.warn('[runner]', ...args),
    });
    runner.sweepStale().catch(() => {});
    registerIpc();

    if (!DEV_URL && !fs.existsSync(DIST_INDEX)) {
      const msg = `Arayüz dosyaları bulunamadı:\n${DIST_INDEX}\n\nÖnce "npm run build" komutunu çalıştır.`;
      if (SMOKE) process.stdout.write(`[smoke] ✗ ${msg}\n`);
      else dialog.showErrorBox('Rusteach', msg);
      app.exit(1);
      return;
    }

    loadWindowState();
    mainWindow = createMainWindow({ beforeLoad: SMOKE ? attachSmokeTest : undefined });
  });

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) mainWindow = createMainWindow();
  });
  app.on('window-all-closed', () => {
    if (!IS_MAC || SMOKE) app.quit();
  });
  app.on('before-quit', () => runner?.dispose());
}

if (SMOKE || app.requestSingleInstanceLock()) boot();
else app.quit();
