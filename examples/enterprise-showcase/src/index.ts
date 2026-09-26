import { createNodeHttpServer } from '@jsango/http';
import { createEnterpriseApp } from './app.js';

async function main() {
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '127.0.0.1';

  console.log('🚀 Bootstrapping JSango Enterprise Showcase...');
  const { app, queue } = await createEnterpriseApp();

  const server = createNodeHttpServer((req) => app.handle(req));
  const addr = await server.listen(port, host);

  console.log('\n======================================================');
  console.log('✨ JSango Enterprise Showcase is LIVE!');
  console.log(`📡 Server Address:      http://${addr.host}:${addr.port}`);
  console.log(`🛡️  Admin Control Panel: http://${addr.host}:${addr.port}/admin`);
  console.log(`🛍️  Public Products API: http://${addr.host}:${addr.port}/api/products`);
  console.log(`📦 Order Placement API: http://${addr.host}:${addr.port}/api/orders`);
  console.log(`🩺 System Diagnostics:  http://${addr.host}:${addr.port}/api/health`);
  console.log('======================================================\n');
  console.log('Demo Credentials for Admin Console:');
  console.log('  Email:    admin@jsango.dev');
  console.log('  Role:     Superuser / Staff Administrator');
  console.log('\nPress Ctrl+C to terminate server.\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down JSango Enterprise Showcase...');
    await queue.close();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Only execute directly when run from CLI
if (process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts')) {
  main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
