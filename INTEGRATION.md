# Clay Terminal - Integration Guide

This guide shows you how to integrate Clay Terminal into your existing project as an NPM package.

## 📦 Installation

```bash
npm install clay-util
```

### Install Peer Dependencies

```bash
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

## 🚀 Quick Integration

### 1. HTML Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App with Terminal</title>
  <!-- Include xterm.css -->
  <link rel="stylesheet" href="node_modules/xterm/css/xterm.css" />
  <style>
    #terminal-container {
      width: 100%;
      height: 100vh;
      background: #1e1e2e;
    }
  </style>
</head>
<body>
  <div id="terminal-container"></div>
  
  <script type="module">
    import { createClayTerminal } from 'clay-util';
    
    const terminal = await createClayTerminal({
      container: document.getElementById('terminal-container')
    });
  </script>
</body>
</html>
```

### 2. React Integration

```bash
npm install clay-util xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

```tsx
// Terminal.tsx
import React, { useEffect, useRef } from 'react';
import { createClayTerminal, ClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  bridgeUrl?: string;
  onCommand?: (command: string) => void;
}

export default function Terminal({ bridgeUrl, onCommand }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<ClayTerminal | null>(null);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    createClayTerminal({
      container: containerRef.current,
      bridgeUrl: bridgeUrl,
      onOutput: (data) => {
        // Handle output
      },
      onError: (error) => {
        console.error('Terminal error:', error);
      },
      onStatusChange: (status) => {
        console.log('Status:', status);
      }
    }).then(terminal => {
      terminalRef.current = terminal;
      
      // Execute initial command if needed
      // terminal.executeCommand('ls -la');
    });

    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
    };
  }, [bridgeUrl]);

  return (
    <div className="terminal-wrapper">
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
```

```css
/* Terminal.css */
.terminal-wrapper {
  width: 100%;
  height: 100%;
}

.terminal-container {
  width: 100%;
  height: 100%;
  padding: 16px;
}
```

### 3. Vue 3 Integration

```bash
npm install clay-util xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

```vue
<template>
  <div ref="terminalContainer" class="terminal-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { createClayTerminal, type ClayTerminal } from 'clay-terminal';
import 'xterm/css/xterm.css';

interface Props {
  bridgeUrl?: string;
}

const props = defineProps<Props>();
const terminalContainer = ref<HTMLDivElement | null>(null);
let terminal: ClayTerminal | null = null;

onMounted(async () => {
  if (terminalContainer.value) {
    terminal = await createClayTerminal({
      container: terminalContainer.value,
      bridgeUrl: props.bridgeUrl,
      onOutput: (data) => {
        // Handle output
      },
      onError: (error) => {
        console.error('Terminal error:', error);
      }
    });
  }
});

onUnmounted(() => {
  if (terminal) {
    terminal.dispose();
  }
});
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100vh;
  background: #1e1e2e;
}
</style>
```

### 4. Next.js Integration

```bash
npm install clay-util xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

```tsx
// app/terminal/page.tsx (Next.js 13+ App Router)
'use client';

import { useEffect, useRef } from 'react';
import { createClayTerminal, type ClayTerminal } from 'clay-terminal';
import 'xterm/css/xterm.css';

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<ClayTerminal | null>(null);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    createClayTerminal({
      container: containerRef.current
    }).then(terminal => {
      terminalRef.current = terminal;
    });

    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="w-full h-screen bg-[#1e1e2e]">
      <div ref={containerRef} className="w-full h-full p-4" />
    </div>
  );
}
```

### 5. Svelte Integration

```bash
npm install clay-util xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createClayTerminal, type ClayTerminal } from 'clay-terminal';
  import 'xterm/css/xterm.css';

  let terminalContainer: HTMLDivElement;
  let terminal: ClayTerminal | null = null;

  onMount(async () => {
    if (terminalContainer) {
      terminal = await createClayTerminal({
        container: terminalContainer
      });
    }
  });

  onDestroy(() => {
    if (terminal) {
      terminal.dispose();
    }
  });
</script>

<div class="terminal-wrapper">
  <div bind:this={terminalContainer} class="terminal-container"></div>
</div>

<style>
  .terminal-wrapper {
    width: 100%;
    height: 100vh;
  }
  
  .terminal-container {
    width: 100%;
    height: 100%;
    padding: 16px;
  }
</style>
```

## 🔧 Advanced Configuration

### Custom Theme

```typescript
import { createClayTerminal } from 'clay-util';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  theme: {
    background: '#0a0a0a',
    foreground: '#ffffff',
    cursor: '#00ff00',
    // ... customize colors
  },
  fontSize: 14,
  fontFamily: 'Monaco, monospace'
});
```

### With Bridge Server (Real System Access)

```typescript
import { createClayTerminal } from 'clay-util';

// Start bridge server first:
// cd bridge && npm install && npm start

const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  bridgeUrl: 'ws://127.0.0.1:8765/ws',
  autoConnectBridge: true,
  onStatusChange: (status) => {
    if (status.backend === 'connected') {
      console.log('✅ Real system access enabled!');
    }
  }
});
```

### Programmatic Command Execution

```typescript
import { createClayTerminal } from 'clay-util';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});

// Execute commands programmatically
await terminal.executeCommand('ls -la');
await terminal.executeCommand('cd ~/Documents');
await terminal.executeCommand('cat file.txt');

// Get command history
const history = terminal.getHistory();

// Get session commands for sharing
const sessionCommands = terminal.getSessionCommands();
```

### Event Handling

```typescript
import { createClayTerminal } from 'clay-util';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  onOutput: (data) => {
    // Handle all terminal output
    console.log('Output:', data);
    
    // You can filter or process output here
    if (data.includes('error')) {
      // Handle errors
    }
  },
  onError: (error) => {
    // Handle terminal errors
    console.error('Terminal error:', error);
    showErrorNotification(error);
  },
  onStatusChange: (status) => {
    // Update UI based on status
    updateStatusIndicator(status.backend, status.ai);
    
    if (status.backend === 'connected') {
      showSuccessMessage('Terminal connected!');
    } else if (status.backend === 'error') {
      showErrorMessage('Connection failed');
    }
  }
});

// You can also register callbacks later
terminal.onOutput((data) => {
  // Additional output handler
});
```

## 📦 Building for Production

### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
  // ... other config
  resolve: {
    alias: {
      'xterm': require.resolve('xterm'),
      'xterm-addon-fit': require.resolve('xterm-addon-fit'),
      'xterm-addon-web-links': require.resolve('xterm-addon-web-links'),
      'xterm-addon-canvas': require.resolve('xterm-addon-canvas')
    }
  }
};
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  // ... other config
  optimizeDeps: {
    include: ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links', 'xterm-addon-canvas']
  }
});
```

## 🎯 Use Cases

### 1. ChromeOS Development Environment

Perfect for ChromeOS users who need terminal access but don't have Linux container enabled:

```typescript
// Works in browser, no Linux container needed
const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});

// For real system access, start bridge server
// Terminal will auto-connect when bridge is available
```

### 2. Web-based IDE

Integrate terminal into your code editor:

```typescript
// In your IDE component
const terminal = await createClayTerminal({
  container: editorRef.current,
  bridgeUrl: 'ws://localhost:8765/ws',
  onOutput: (data) => {
    // Sync output with editor
  }
});
```

### 3. Educational Platform

Teach terminal commands interactively:

```typescript
const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  showWelcome: true
});

// Pre-populate with tutorial commands
await terminal.executeCommand('echo "Welcome to Terminal Basics!"');
```

### 4. Documentation Site

Interactive terminal examples:

```typescript
// In your docs site
const terminal = await createClayTerminal({
  container: document.getElementById('terminal-example')
});

// Show example commands
await terminal.executeCommand('git clone https://github.com/user/repo.git');
```

## 🔐 Security Considerations

- **Bridge Server**: Only connect to trusted bridge servers (localhost by default)
- **Command Execution**: Be careful with user input - validate commands before execution
- **CORS**: Ensure proper CORS configuration if using remote bridge servers

## 📚 Additional Resources

- [Full API Documentation](./README-PACKAGE.md)
- [Bridge Server Setup](../bridge/README.md)
- [Web App Usage](../README.md)

## 💬 Support

For integration help:
- Check [examples](./README-PACKAGE.md#examples)
- Open an issue on GitHub
- Read the [full documentation](./README-PACKAGE.md)

