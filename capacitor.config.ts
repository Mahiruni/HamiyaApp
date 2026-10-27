import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hamiyainvestmentgroup.customer',
  appName: 'Hamiya Investment Group – HIG',
  webDir: 'dist',
  backgroundColor: '#f4f7fa',
  zoomEnabled: true,
  plugins: {
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
