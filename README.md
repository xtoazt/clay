# Clay Terminal

A beautiful, modern terminal built with Electron and Web technologies, inspired by [Hyper](https://hyper.is/). Clay provides a full-featured terminal experience that runs on Chromebooks (as a PWA) and desktop (Electron), allowing you to execute shell scripts, ADB commands, and any other terminal commands you need.

## 📦 NPM Package

Clay Terminal is also available as an **NPM package** for easy integration into existing projects:

```bash
npm install clay-util
```

**Perfect for ChromeOS users** - Access terminal functionality directly from the web, even without terminal app access!

See [Integration Guide](./INTEGRATION.md) for detailed integration examples, or [Package Documentation](./README-PACKAGE.md) for full API reference.

**Now with Real System Access!** - The web version can connect to a local bridge server for **real system command execution** and **real filesystem access**. Or run in browser-only mode with Web Workers as a fallback.

## 🚀 Quick Start

### Web Version with Real System Access

**For real system command execution and filesystem access:**

1. **Start the bridge server:**
   ```bash
   ./start-bridge.sh
   ```
   Or manually:
   ```bash
   cd bridge
   npm install
   npm start
   ```

2. **Start the web terminal:**
   ```bash
   cd web
   npm install
   npm run dev
   ```

3. **Open `http://localhost:3000`** - The terminal will automatically connect to the bridge!

**With bridge running, you get:**
- ✅ Real system command execution (full bash)
- ✅ Real filesystem access (your actual files)
- ✅ All commands work (not just a limited set)

**Without bridge:** Falls back to Web Worker mode (browser-only, limited commands)

### Electron Version (Desktop App)

For the desktop version:
```bash
npm install
npm run build
npm start
```

### Web Version (Static PWA) - **60 Seconds!**
For static deployment without backend:
1. **Enable GitHub Pages:** Repository → Settings → Pages → Source: "GitHub Actions"
2. **Push to main:** `git push origin main`
3. **Done!** Visit: `https://yourusername.github.io/clay/`
4. **Install on Chromebook:** Click "Install" button!

👉 **See [QUICK_START.md](.github/QUICK_START.md) for step-by-step instructions**

### Electron App Releases
1. **Create a release** on GitHub (tag: `v1.0.0`)
2. **Automatically builds** for macOS, Linux, Windows
3. **Download** from the release page!

👉 **See [DEPLOYMENT.md](.github/DEPLOYMENT.md) for detailed instructions**

## Features

- 🖥️ **Real Terminal Functionality** - Full PTY (pseudo-terminal) support via node-pty for true terminal emulation, just like VS Code's integrated terminal
- ⚡ **AI-Powered Assistant** - Built-in AI assistant with Quick Fix for automatic error diagnosis and resolution
- 🎨 **Hyper-Inspired UI** - Beautiful, clean interface based on [Hyper terminal](https://hyper.is/)
- 📜 **Command History** - Navigate through previous commands with arrow keys
- 📁 **Directory Navigation** - Full `cd` and `pwd` support with `~` expansion
- 🔄 **Streaming Support** - Real-time output for interactive commands
- 🎯 **Interactive Programs** - Support for vim, nano, htop, python interactive mode, and more
- ⌨️ **Keyboard Shortcuts** - Ctrl+C to cancel, Alt+F for Quick Fix, arrow keys for history
- 🎯 **Platform Agnostic** - Works on Windows, macOS, and Linux (perfect for Chromebooks)
- 🚀 **Fast & Responsive** - Optimized for smooth performance
- 🖱️ **Terminal Resizing** - Automatic terminal dimension updates on window resize
- 🌈 **ANSI Support** - Proper handling of colored terminal output and escape codes

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Build the project:**
```bash
npm run build
```

3. **Start the application:**
```bash
npm start
```

Or use the dev script for development:
```bash
npm run dev
```

## Usage

Once Clay Terminal starts, you can:

- **Type any shell command** and press Enter to execute it
- **Use `cd <directory>`** to change directories (supports `~` for home directory)
- **Use `pwd`** to see the current directory
- **Use `clear` or `cls`** to clear the terminal
- **Use `help`** to see available built-in commands
- **Use Arrow Up/Down** to navigate command history
- **Use Ctrl+C** to cancel the current command

### Example Commands

```bash
# File operations
ls -la
cat file.txt
grep "search" file.txt

# ADB commands
adb devices
adb install app.apk
adb shell pm list packages

# Development tools
npm install
python script.py
git status

# System commands
ps aux
df -h
top
```

## Built-in Commands

- `clear` / `cls` - Clear the terminal screen
- `cd <dir>` - Change to a different directory (use `~` for home)
- `pwd` - Print the current working directory
- `help` - Show help message

## Project Structure

```
├── src/              # Main process TypeScript files
│   ├── main.ts      # Electron main process with command execution
│   └── preload.ts   # Preload script for secure IPC
├── renderer/         # Renderer process files
│   ├── index.html   # Main HTML file
│   ├── styles.css   # Hyper-inspired terminal styling
│   └── renderer.ts  # Terminal logic and UI
├── dist/             # Compiled JavaScript (generated)
└── package.json      # Project configuration
```

## Development

The project uses TypeScript for type safety. The main process runs in Node.js with secure IPC communication, while the renderer process runs in a Chromium-based browser window.

### Building

```bash
npm run build
```

This will:
1. Compile all TypeScript files
2. Copy HTML and CSS files to the dist folder

### Development Mode

```bash
npm run dev
```

Runs the build and starts Electron in development mode.

## Security

Clay Terminal uses Electron's security best practices:
- **Context isolation** enabled
- **Node integration** disabled in renderer
- **Secure IPC communication** via preload script
- **Process management** with proper cleanup

## Shell Support

Clay Terminal automatically detects and uses the system's default shell:
- **Windows**: `cmd.exe` or `COMSPEC`
- **macOS/Linux**: `bash`, `zsh`, or `SHELL` environment variable

## Real Terminal Emulation

Clay uses [node-pty](https://github.com/microsoft/node-pty), the same library that powers VS Code's integrated terminal, for true terminal emulation:

- **PTY Support**: Real pseudo-terminal (PTY) sessions for interactive programs
- **Interactive Programs**: Run vim, nano, htop, python interactive mode, and more
- **Real Input Handling**: Proper keyboard input forwarding to interactive programs
- **Terminal Resizing**: Automatic dimension updates when the window is resized
- **ANSI Codes**: Full support for colored output and terminal escape sequences

This gives you a **real terminal experience** - not just command execution, but actual terminal emulation like you'd get in a native terminal application.

## Perfect for Chromebooks

Clay Terminal is designed to work on Chromebooks where you might not have direct access to the native terminal. 

**With Bridge Server (Recommended):**
- ✅ Real system command execution (full bash)
- ✅ Real filesystem access (your actual files)
- ✅ All commands work (not just a limited set)
- ✅ Interactive programs (vim, nano, htop, etc.)

**Without Bridge (Fallback):**
- Browser-only execution (Web Worker)
- Virtual filesystem (in-memory)
- Limited command set

**To get real system access:** Start the bridge server with `./start-bridge.sh` or install it as a system service.

## Inspiration

This terminal is inspired by [Hyper](https://hyper.is/), a beautiful terminal built on web technologies. Clay brings that same beautiful experience with enhanced functionality for command execution.

## License

MIT
