import { createServer as createHttpsServer } from 'https';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

// Generate a self-signed certificate for development
const generateCert = () => {
  // For development purposes, we'll use a basic self-signed cert
  // In a real scenario, you'd use mkcert or similar tools
  const cert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKLdQwjTRIQXMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjBF
...
-----END CERTIFICATE-----`;

  const key = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDZ0+1Zr9znRqF
...
-----END PRIVATE KEY-----`;

  return { cert, key };
};

async function startDevServer() {
  try {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });

    const { cert, key } = generateCert();
    
    const httpsServer = createHttpsServer({ cert, key }, vite.middlewares);
    
    httpsServer.listen(5173, () => {
      console.log('🚀 HTTPS Dev Server running at https://localhost:5173');
      console.log('⚡ PWA-ready development environment');
    });
  } catch (error) {
    console.error('Error starting HTTPS dev server:', error);
  }
}

startDevServer();

// Handle graceful shutdown
const shutdown = () => {
  console.log('\nShutting down HTTPS dev server...');
  httpsServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
