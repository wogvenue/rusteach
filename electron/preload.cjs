// Rusteach preload (sandboxed, context-isolated): exposes window.rusteach - exactly the
// RusteachBridge interface of src/types/bridge.ts - and nothing else.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Values main.cjs passes through webPreferences.additionalArguments. */
function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

// index.html starts with data-theme="dark". For a learner who uses the light theme, switch before
// the first paint (React re-applies the stored setting right after), so the window never flashes dark.
if (arg('rusteach-theme') === 'light') {
  const apply = () => {
    const root = document.documentElement;
    if (!root) return false;
    root.dataset.theme = 'light';
    return true;
  };
  if (!apply()) {
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(document, { childList: true });
  }
}

contextBridge.exposeInMainWorld('rusteach', {
  isElectron: true,
  platform: process.platform,
  appVersion: arg('rusteach-version'),
  run: (req) => ipcRenderer.invoke('rust:run', req),
  toolchain: () => ipcRenderer.invoke('rust:toolchain'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', String(url)),
  saveTextFile: (defaultName, content) =>
    ipcRenderer.invoke('file:save', { defaultName: String(defaultName ?? ''), content: String(content ?? '') }),
  openTextFile: () => ipcRenderer.invoke('file:open'),
  setTitleBarTheme: (theme) => ipcRenderer.send('titlebar:theme', theme === 'light' ? 'light' : 'dark'),
});
