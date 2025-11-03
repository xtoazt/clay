# Clay Terminal - Usage Guide

## Quick Start

### Installation

```bash
npm install clay-util
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

### Basic Usage

```typescript
import { createClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});
```

### With Real System Access

1. Start the bridge server:
   ```bash
   cd bridge
   npm install
   npm start
   ```

2. Connect from your app:
   ```typescript
   const terminal = await createClayTerminal({
     container: document.getElementById('terminal'),
     bridgeUrl: 'ws://127.0.0.1:8765/ws'
   });
   ```

## API Reference

### `createClayTerminal(config)`

Creates and initializes a terminal instance.

**Config Options:**
- `container` (HTMLElement) - Required. DOM element to mount terminal
- `bridgeUrl` (string) - Optional. Bridge server WebSocket URL
- `theme` (object) - Optional. Custom theme colors
- `fontSize` (number) - Optional. Font size (default: 13)
- `fontFamily` (string) - Optional. Font family
- `onOutput` (function) - Optional. Output callback
- `onError` (function) - Optional. Error callback
- `onStatusChange` (function) - Optional. Status change callback

### `ClayTerminal` Methods

- `write(data)` - Write data to terminal
- `executeCommand(command)` - Execute a command
- `getHistory()` - Get command history
- `getSessionCommands()` - Get session commands
- `clear()` - Clear terminal
- `resize()` - Resize terminal
- `dispose()` - Cleanup

## Examples

See [INTEGRATION.md](../../INTEGRATION.md) for complete examples.

## ChromeOS Usage

Perfect for ChromeOS users! The terminal works entirely in the browser, no Linux container needed. For real system access, run the bridge server in the Linux container.

