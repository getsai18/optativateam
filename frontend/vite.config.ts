import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Injects a strict Content-Security-Policy into the production build only (dev needs inline HMR scripts). */
function csp(apiOrigins: string[]): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigins.join(' ')}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const origins = [env.VITE_API_URL, env.VITE_LAMBDA_URL].filter((v): v is string => Boolean(v));
  return {
    plugins: [react(), csp(origins)],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
