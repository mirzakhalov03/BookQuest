import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One .env at the repo root serves every workspace.
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    // The Telegram Mini App loads over https through a tunnel in development.
    host: true
  }
});
