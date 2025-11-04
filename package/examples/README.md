# Clay Terminal Examples

This directory contains example integrations of Clay Terminal.

## Examples

### basic.ts
TypeScript example showing basic terminal integration using the backend API.

To use:
1. Build the package: `npm run build:package`
2. Import and use in your TypeScript project:
   ```typescript
   import { initBackend, executeCommand } from './examples/basic';
   
   await initBackend();
   await executeCommand('ls');
   ```

## Using in Your Project

See [INTEGRATION.md](../../INTEGRATION.md) for detailed integration examples for:
- React
- Vue
- Next.js
- Svelte
- Plain TypeScript/JavaScript
