import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aegiscall.screener',
  appName: 'AegisCall AI',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true
  },
  plugins: {}
};

export default config;
