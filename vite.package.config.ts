import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'package/index.ts'),
      name: 'ClayBackend',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'clay-util.esm.js' : 'clay-util.js'
    },
    rollupOptions: {
      // No external dependencies - package is self-contained backend
      external: [],
      output: {
        globals: {}
      }
    },
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [
    {
      name: 'copy-declaration',
      buildStart() {
        // Before Vite clears dist, save the declaration file to a temp location
        const dtsPath = resolve(__dirname, 'dist/index.d.ts');
        const tempPath = resolve(__dirname, '.clay-util.d.ts.tmp');
        if (existsSync(dtsPath)) {
          writeFileSync(tempPath, readFileSync(dtsPath, 'utf-8'));
        }
      },
      writeBundle() {
        // After Vite builds, restore and rename the declaration file
        const tempPath = resolve(__dirname, '.clay-util.d.ts.tmp');
        const targetPath = resolve(__dirname, 'dist/clay-util.d.ts');
        
        if (existsSync(tempPath)) {
          const content = readFileSync(tempPath, 'utf-8');
          writeFileSync(targetPath, content);
          // Clean up temp file
          try {
            require('fs').unlinkSync(tempPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    }
  ]
});

