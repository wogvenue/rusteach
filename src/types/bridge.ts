// Contract between the renderer and the Electron main process (window.rusteach).
// In a plain browser (npm run web) window.rusteach is undefined and src/lib/runner.ts
// falls back to the Rust Playground through the Vite dev proxy.

export type RunMode = 'run' | 'test' | 'compile';

export interface RunRequest {
  code: string;
  mode: RunMode; // run = compile+execute, test = cargo test, compile = type/borrow check only
  crateType?: 'bin' | 'lib'; // default: 'bin' if code has fn main, else 'lib'
  crates?: string[]; // external crates used (tokio, serde, rand...)
  stdin?: string; // only supported by the local backend
  backend?: 'auto' | 'local' | 'online'; // user setting; default auto
}

export interface RunResult {
  ok: boolean; // process exit code 0 (tests: all passed)
  stdout: string;
  stderr: string; // compiler output + runtime stderr (cargo noise lines removed)
  compileError: boolean; // failed during compilation
  timedOut: boolean;
  durationMs: number;
  backend: 'local' | 'online';
  infraError?: string; // could not run at all (offline, playground down...) - show a friendly message
}

export interface ToolchainInfo {
  rustc: string | null; // "rustc 1.90.0 (...)" or null when not installed
  cargo: string | null;
}

export interface RusteachBridge {
  isElectron: true;
  platform: string; // process.platform
  appVersion: string;
  run(req: RunRequest): Promise<RunResult>;
  toolchain(): Promise<ToolchainInfo>;
  openExternal(url: string): Promise<void>;
  /** Shows a save dialog; returns true when saved. */
  saveTextFile(defaultName: string, content: string): Promise<boolean>;
  /** Shows an open dialog; returns file content or null when cancelled. */
  openTextFile(): Promise<string | null>;
  /** Updates the native title bar overlay colors (Windows) when the theme changes. */
  setTitleBarTheme?(theme: 'dark' | 'light'): void;
}

declare global {
  interface Window {
    rusteach?: RusteachBridge;
  }
}
