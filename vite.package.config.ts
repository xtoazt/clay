import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'package/index.ts'),
      name: 'ClayTerminal',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'clay-util.esm.js' : 'clay-util.js'
    },
    rollupOptions: {
      external: ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links', 'xterm-addon-canvas'],
      output: {
        globals: {
          'xterm': 'Terminal',
          'xterm-addon-fit': 'FitAddon',
          'xterm-addon-web-links': 'WebLinksAddon',
          'xterm-addon-canvas': 'CanvasAddon'
        }
      }
    },
    outDir: 'dist',
    sourcemap: true
  }
});

