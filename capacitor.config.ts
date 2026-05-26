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
    GoogleSignIn: {
      clientId: '843035088451-3nj36i8ngqltbvr99qftagv0jc92opc4.apps.googleusercontent.com'
    }
  }
};

export default config;
