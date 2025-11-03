# Clay Terminal - NPM Package Setup

## 📦 Package Structure

```
clay/
├── package/              # NPM package source code
│   ├── core/             # Core terminal implementation
│   ├── backend/          # Backend implementations
│   ├── utils/            # Utility functions
│   ├── examples/         # Example integrations
│   ├── types.ts          # TypeScript type definitions
│   ├── index.ts          # Package entry point
│   └── clay-terminal.ts  # Main export file
├── dist/                 # Built package files (generated)
├── package.json          # NPM package configuration
├── tsconfig.package.json # TypeScript config for package
├── vite.package.config.ts # Vite build config for package
├── README-PACKAGE.md     # Package documentation
└── INTEGRATION.md        # Integration guide
```

## 🚀 Building the Package

### Build Package Only

```bash
npm run build:package
```

This will:
1. Compile TypeScript files from `package/` to `dist/`
2. Bundle with Vite into ES and CommonJS formats
3. Generate TypeScript declaration files

### Build Everything

```bash
npm run build
```

Builds both the web app and the NPM package.

## 📝 Publishing to NPM

1. **Update version** in `package.json`

2. **Build the package:**
   ```bash
   npm run build:package
   ```

3. **Test locally:**
   ```bash
   npm pack
   # This creates a .tgz file you can test
   ```

4. **Publish to NPM:**
   ```bash
   npm publish
   ```

## 🔧 Package Configuration

The package is configured in `package.json`:

- **Main entry**: `dist/clay-util.js` (CommonJS)
- **Module entry**: `dist/clay-util.esm.js` (ES Modules)
- **Types**: `dist/clay-util.d.ts`
- **Peer dependencies**: xterm and addons (required by users)

## 📚 Documentation Files

- **README-PACKAGE.md** - Full package documentation with API reference
- **INTEGRATION.md** - Integration examples for React, Vue, Next.js, etc.
- **package/USAGE.md** - Quick usage guide

## ✅ What's Included

The package includes:
- ✅ Core terminal class (`ClayTerminal`)
- ✅ Bridge backend (for real system access)
- ✅ Web Worker backend (browser-only)
- ✅ Session encoder (for sharing)
- ✅ Full TypeScript types
- ✅ Helper function (`createClayTerminal`)

## 🎯 Usage

Users install and use like this:

```bash
npm install clay-util
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

```typescript
import { createClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});
```

## 🔄 Development Workflow

1. **Develop in web/** - The web app continues to work as before
2. **Package code in package/** - Exportable terminal functionality
3. **Build package** - `npm run build:package`
4. **Test integration** - Use examples in `package/examples/`
5. **Publish** - `npm publish` when ready

## 📝 Notes

- The existing web app (`web/`) is **completely untouched** - it continues to work exactly as before
- Package code is in `package/` directory - separate from web app
- Both can coexist - web app for standalone use, package for integration
- Package users need to install peer dependencies themselves

