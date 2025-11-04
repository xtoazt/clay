/**
 * HTML Generator - Dynamically creates the HTML structure
 * This replaces all static HTML files with TypeScript-generated HTML
 */

export function generateHTML(): string {
  // Runtime: detect base path from window location (browser-compatible)
  let base = '/';
  
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    // Extract base path (e.g., /clay/ from /clay/)
    const match = path.match(/^(\/[^\/]+\/)/);
    if (match) {
      base = match[1];
    }
  }
  
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

/**
 * Initialize HTML structure if not already present
 */
export function initializeHTML(): void {
  if (document.documentElement.tagName.toLowerCase() === 'html') {
    // HTML already exists, ensure app-root exists
    let appRoot = document.getElementById('app-root');
    if (!appRoot) {
      appRoot = document.createElement('div');
      appRoot.id = 'app-root';
      document.body.appendChild(appRoot);
    }
    return;
  }
  
  // If for some reason we're in a non-HTML context, create it
  // This is a fallback for edge cases
  if (!document.documentElement) {
    const html = generateHTML();
    document.open();
    document.write(html);
    document.close();
  }
}

