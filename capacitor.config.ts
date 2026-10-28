import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hamiyainvestmentgroup.customer',
  appName: 'Hamiya Investment Group – HIG',
  webDir: 'dist',
  backgroundColor: '#193b4d',
  zoomEnabled: true,
  plugins: {
    CapacitorUpdater: {
      autoUpdate: 'off',
      appReadyTimeout: 30000,
      statsUrl: '',
      updateUrl: '',
      channelUrl: '',
      resetWhenUpdate: true,
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
      hidden: false,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#f4f7fa',
  },
};

export default config;
