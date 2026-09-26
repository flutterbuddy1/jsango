import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');

const outDir = path.resolve(pkgRoot, 'dist', 'client');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function build() {
  console.log('⚡ Bundling React Admin SPA with esbuild...');
  const result = await esbuild.build({
    entryPoints: [path.resolve(pkgRoot, 'src', 'react', 'entry.tsx')],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'iife',
    target: ['es2020'],
    write: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const bundleCode = result.outputFiles[0].text;
  fs.writeFileSync(path.resolve(outDir, 'admin-app.bundle.js'), bundleCode, 'utf-8');

  // Write embedded constant for server handler
  const bundleTsContent = `/**
 * Auto-generated React Admin SPA Client Bundle
 * Generated at build time by esbuild. DO NOT EDIT DIRECTLY.
 */
export const ADMIN_APP_BUNDLE_JS = ${JSON.stringify(bundleCode)};
`;

  fs.writeFileSync(path.resolve(pkgRoot, 'src', 'page', 'bundle-content.ts'), bundleTsContent, 'utf-8');
  console.log('✅ React Admin SPA bundle generated and embedded successfully.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
