# Clay Terminal - Quick Start Guide

## 🚀 30-Second Setup

### 1. Install

```bash
npm install clay-util
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

### 2. Use

```typescript
import { createClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});
```

### 3. Done! 🎉

You now have a fully functional terminal in your web app!

## 📖 Next Steps

- **Full documentation**: See [README-PACKAGE.md](../README-PACKAGE.md)
- **Integration examples**: See [INTEGRATION.md](../INTEGRATION.md)
- **ChromeOS setup**: See [README-PACKAGE.md - ChromeOS Integration](../README-PACKAGE.md#chromeos-integration)

## 🔗 Real System Access

For ChromeOS users who want real system command execution:

1. **Get the bridge server** from this repository
2. **Start it:**
   ```bash
   cd bridge && npm install && npm start
   ```
3. **Connect:**
   ```typescript
   const terminal = await createClayTerminal({
     container: document.getElementById('terminal'),
     bridgeUrl: 'ws://127.0.0.1:8765/ws'
   });
   ```

That's it! Perfect for ChromeOS! 🎯

