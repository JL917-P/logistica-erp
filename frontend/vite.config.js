import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  /** En desarrollo, proxy hacia el backend (sin URL fija en el cliente). */
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3001';

  return {
    plugins: [react()],
    /** Deploy en raíz del sitio (Render, mismo origen que /api). */
    base: '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false
    },
    server: {
      port: Number(env.VITE_DEV_PORT) || 2000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
