import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nihongo.master',
  appName: 'Nihongo Master',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  server: {
    allowNavigation: [
      'accounts.google.com',
      '*.google.com',
      '*.kuislatihanbahasajepang.web.id',
      'kuislatihanbahasajepang.web.id'
    ]
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: '843035088451-irpb18dkkosr3bm0rilffh20r1shhmq9.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
