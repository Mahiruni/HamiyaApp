import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export default defineConfig(({ mode, command }) => {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
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
  const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: ${new URL(url).origin}; connect-src 'self' https://hamiyainvestmentgroup.vercel.app ${new URL(url).origin} ${new URL(url).origin.replace('https:', 'wss:')}; font-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;
  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_COMMIT__: JSON.stringify(commit),
      __UPDATE_PUBLIC_KEY__: JSON.stringify(env.VITE_HAMIYA_UPDATE_PUBLIC_KEY || ''),
    },
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
                {
                  tag: 'meta',
                  attrs: {
                    name: 'hamiya-build',
                    content: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
                  },
                  injectTo: 'head' as const,
                },
              ]
            : [];
        },
        writeBundle(options, bundle) {
          const assets = Object.keys(bundle)
            .filter((name) => /\.(js|css)$/.test(name))
            .map((name) => '/' + name);
          const version = createHash('sha256')
            .update(JSON.stringify(assets))
            .digest('hex')
            .slice(0, 12);
          const worker = readFileSync('public/sw.js', 'utf8')
            .replace('/* HAMIYA_BUILD_ASSETS */ []', JSON.stringify(assets))
            .replace('hamiya-shell-v7', 'hamiya-shell-' + version);
          writeFileSync(resolve(options.dir || 'dist', 'sw.js'), worker);
        },
      },
    ],
    server: { host: '0.0.0.0', port: 4173, allowedHosts: ['terminal.local'] },
    build: {
      sourcemap: false,
      target: 'es2022',
      rolldownOptions: {
        input: { app: resolve('index.html'), marketing: resolve('marketing.html') },
        output: {
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'supabase-vendor', test: /node_modules[\\/]@supabase[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
