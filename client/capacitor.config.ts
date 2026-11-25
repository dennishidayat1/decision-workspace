import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.my.dennishidayat.decisionworkspace',
  appName: 'Decision Workspace',
  webDir: 'dist/decision-workspace-web/browser',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
};

export default config;
