// Android build (Capacitor) wrapping the same Vite renderer the desktop app ships.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rusteach.app',
  appName: 'Rusteach',
  webDir: 'dist',
  backgroundColor: '#0b0e14',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
