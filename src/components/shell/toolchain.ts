// Local Rust toolchain status (Electron only), cached and shared by the top bar chip and Settings.
import { create } from 'zustand';
import type { ToolchainInfo } from '../../types/bridge';

interface ToolchainState {
  info: ToolchainInfo | null;
  loading: boolean;
  checked: boolean;
  refresh(): Promise<void>;
}

export const useToolchain = create<ToolchainState>()((set, get) => ({
  info: null,
  loading: false,
  checked: false,
  refresh: async () => {
    const bridge = window.rusteach;
    if (!bridge || get().loading) {
      set({ checked: true });
      return;
    }
    set({ loading: true });
    try {
      const info = await bridge.toolchain();
      set({ info, loading: false, checked: true });
    } catch {
      set({ info: { rustc: null, cargo: null }, loading: false, checked: true });
    }
  },
}));

export const isElectron = () => !!window.rusteach;

export type RunnerKind = 'local' | 'online' | 'missing' | 'checking';

/** Which backend code will actually run on, given the setting and the detected toolchain. */
export function effectiveRunner(setting: 'auto' | 'local' | 'online', info: ToolchainInfo | null, checked: boolean): RunnerKind {
  if (!window.rusteach || setting === 'online') return 'online';
  if (!checked) return 'checking';
  const hasRust = !!info?.rustc;
  if (setting === 'local') return hasRust ? 'local' : 'missing';
  return hasRust ? 'local' : 'online';
}

/** Opens a URL in the system browser (Electron) or a new tab. */
export function openExternal(url: string) {
  if (window.rusteach) void window.rusteach.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
