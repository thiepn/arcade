import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), {
    name: 'arcade-versioned-service-worker',
    generateBundle(_options, bundle) {
      const source = readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(source);
      hash.update(readFileSync(new URL('./index.html', import.meta.url)));
      const hashPublicFiles = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) hashPublicFiles(file);
          else if (entry.isFile()) hash.update(path.relative(import.meta.dirname, file).replaceAll('\\', '/')).update(readFileSync(file));
        }
      };
      hashPublicFiles(path.join(import.meta.dirname, 'public'));
      for (const [name, asset] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        hash.update(name).update(asset.type === 'chunk' ? asset.code : asset.source);
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replace('__ARCADE_BUILD_ID__', hash.digest('hex').slice(0, 20)) });
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      // The registry keeps the historical compatibility-slot import strings so
      // the 32-slot AP/Worker/source contracts remain unchanged. At bundle time,
      // route those two retired implementations to their replacements so Gravity
      // and Astro Blaster are not shipped or precached as dead production chunks.
      '../games/GravityGame': path.resolve(import.meta.dirname, 'src/games/VectorGolf.tsx'),
      '../games/AstroBlasterGame': path.resolve(import.meta.dirname, 'src/games/HexCapture.tsx'),
    },
  },
  build: {
    manifest: 'asset-manifest.json',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
          if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion-vendor';
          if (id.includes('/lucide-react/')) return 'icons-vendor';
          if (id.includes('/canvas-confetti/')) return 'confetti';
          return undefined;
        },
      },
    },
  },
});