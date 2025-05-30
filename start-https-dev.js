import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// Create a temporary vite config that extends the existing one with HTTPS
const httpsViteConfig = `
import { defineConfig, loadConfigFromFile } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    https: {
      key: readFileSync('.certs/localhost+2-key.pem'),
      cert: readFileSync('.certs/localhost+2.pem'),
    },
    port: 5173,
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
  },
  plugins: []
});
`;

writeFileSync('vite.config.https.js', httpsViteConfig);

// Start Vite with the HTTPS config
const viteProcess = spawn('npx', ['vite', '--config', 'vite.config.https.js'], {
  stdio: 'inherit',
  shell: true
});

viteProcess.on('close', (code) => {
  console.log(`Vite process exited with code ${code}`);
});

console.log('🚀 Starting HTTPS development server...');
console.log('📱 Your PWA will be available at https://localhost:5173');
console.log('⚠️  You may need to accept the security warning in your browser');
