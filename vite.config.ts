import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (key.startsWith('sb_secret_'))
    throw new Error('Use a Supabase publishable key, never a secret key.');
  if (key && key.split('.').length === 3) {
    let role = '';
    try {
      role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
    } catch {
      throw new Error('Invalid Supabase frontend key.');
    }
    if (role !== 'anon') throw new Error('A legacy frontend key must have the anon role.');
  }
  const url = env.VITE_SUPABASE_URL || 'https://lhdsodqeojxogcwgyjpo.supabase.co';
  const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: ${new URL(url).origin}; connect-src 'self' ${new URL(url).origin} ${new URL(url).origin.replace('https:', 'wss:')}; font-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;
  return {
    plugins: [
      react(),
      {
        name: 'hamiya-production-policy',
        transformIndexHtml() {
          return command === 'build'
            ? [
                {
                  tag: 'meta',
                  attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
                  injectTo: 'head-prepend' as const,
                },
              ]
            : [];
        },
      },
    ],
    server: { host: '0.0.0.0', port: 4173, allowedHosts: ['terminal.local'] },
    build: { sourcemap: false, target: 'es2022' },
  };
});
