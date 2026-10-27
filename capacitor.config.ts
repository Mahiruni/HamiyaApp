import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hamiyainvestmentgroup.customer',
  appName: 'Hamiya Investment Group – HIG',
  webDir: 'dist',
  backgroundColor: '#f4f7fa',
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
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
      hidden: false,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#f4f7fa',
  },
};

export default config;
