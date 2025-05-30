import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { readFileSync } from 'fs';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    https: {
      key: readFileSync('.certs/localhost+2-key.pem'),
      cert: readFileSync('.certs/localhost+2.pem'),
    },
    port: 5173,
    host: 'localhost'
  }
});
