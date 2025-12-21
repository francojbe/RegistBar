import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.registbar.app',
  appName: 'RegistBar',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '507498495844-a6t102dmlfh4tffgj8o8f61uls2oc8n0.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
