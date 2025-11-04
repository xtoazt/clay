import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Generate HTML from TypeScript
function generateHTMLFromTS(): string {
  const base = process.env.GITHUB_REPOSITORY 
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` 
    : '/';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1e1e2e">
  <meta name="description" content="Clay Terminal - The best terminal experience in your browser">
  <title>Clay Terminal</title>
  <link rel="manifest" href="${base}manifest.webmanifest">
  <link rel="apple-touch-icon" href="${base}apple-touch-icon.png">
</head>
<body>
  <div id="app-root"></div>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script type="module" src="${base}src/main.ts"></script>
</body>
</html>`;
}

// Custom plugin to generate HTML from TypeScript
function htmlGeneratorPlugin() {
  return {
    name: 'html-generator',
    buildStart() {
      // Generate HTML file at build start
      const html = generateHTMLFromTS();
      const htmlPath = join(process.cwd(), 'index.html');
      writeFileSync(htmlPath, html, 'utf-8');
    },
    configureServer(server: any) {
      // For dev server, serve generated HTML
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/' || req.url === '/index.html') {
          const html = generateHTMLFromTS();
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  base: process.env.GITHUB_REPOSITORY 
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` 
    : '/',
  plugins: [
    htmlGeneratorPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Clay Terminal',
        short_name: 'Clay',
        description: 'The best terminal experience in your browser',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  worker: {
    format: 'es'
  }
});
