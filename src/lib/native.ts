// Android (Capacitor) integration. On desktop/web every helper here is a no-op or falls back;
// plugins are loaded lazily so the Electron bundle never pulls them in.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/** Writes a text file to the cache and opens the Android share sheet (save to Drive, Files, mail...). */
export async function shareTextFile(name: string, content: string): Promise<boolean> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: name, files: [uri], dialogTitle: name });
    return true;
  } catch {
    return false; // user dismissed the sheet
  }
}

/** Opens a link outside the app: Electron's system browser, an Android Custom Tab, or a new browser tab. */
export function openUrl(url: string): void {
  if (window.rusteach) void window.rusteach.openExternal(url);
  else if (isNative) void import('@capacitor/browser').then(({ Browser }) => Browser.open({ url }));
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/** Status bar colors + hardware back button. Called once at startup. */
export async function initNative(): Promise<void> {
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  void App.addListener('backButton', ({ canGoBack }) => {
    // Let open dialogs/sheets close themselves first (they listen for Escape).
    const open = document.querySelector('[role="dialog"], [data-back-closes]');
    if (open) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    const atHome = location.hash === '' || location.hash === '#/' || location.hash === '#';
    if (canGoBack && !atHome) history.back();
    else void App.minimizeApp();
  });
}

/** Matches the system bars to the current theme. */
export async function syncSystemBars(dark: boolean): Promise<void> {
  if (!isNative) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
}
