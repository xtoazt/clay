# Azalea Terminal - Enhanced Edition

A powerful, feature-rich terminal that runs in your browser with real system access, AI assistance, and cross-platform support.

## 🌟 Features

### Core Terminal
- **Full Terminal Emulation** - xterm.js with advanced addons (Search, Unicode11, Image, Ligatures)
- **Multi-Tab Support** - Manage multiple terminal sessions
- **Command Palette** - Fuzzy search for commands (Ctrl+P)
- **Keyboard Shortcuts** - Comprehensive shortcut system
- **Session Sharing** - Share terminal sessions via URL

### System Access
- **Enhanced Bridge System** - Automatic fallback between bridge types
  - External Bridge (Node.js server) - Full system access
  - WebVM Bridge - Browser-based fallback
  - Automatic reconnection and health monitoring
- **Robust Bridge Server** - Always-running bridge with auto-restart
  - Bridge Manager - Automatic restart and health monitoring
  - Error recovery - Graceful error handling and recovery
  - Health checks - Continuous health monitoring
  - Service installation - Auto-start on system boot
- **Root/Privileged Access** - Execute commands with elevated privileges
- **ChromeOS Integration** - Special support for ChromeOS with auto-start
- **Cross-Platform** - Works on ChromeOS, macOS, Windows, Linux

### AI Assistant
- **JOSIEFIED AI** - Local AI inference using WebLLM
- **Always Available** - AI works even if terminal backend fails
- **File-Aware** - AI can discuss your filesystem
- **Auto-Fix** - AI automatically fixes command errors
- **Multiple Quantization Options** - Q4, Q8, F16 for performance/quality tradeoff

### ChromeOS Features
- **Hidden Settings Unlocker** - Access all ChromeOS settings
- **Linux Files Integration** - Automatic file saving to Linux Files
- **ADB Connection** - Enable ADB debugging
- **Developer Mode** - Enable developer features
- **Guest Mode** - Enable guest browsing
- **User Management** - Add/manage user accounts

### UI/UX
- **Modern Design** - Dark blue/orange theme with glassmorphism
- **Smooth Animations** - Subtle, professional animations
- **Responsive Layout** - Works on all screen sizes
- **Status Indicators** - Real-time connection status
- **Notifications** - Toast notification system
- **File Manager** - Visual file browser (Ctrl+E)
- **Browser Automation Panel** - Visual Puppeteer browser management (Ctrl+B)

## 🚀 Quick Start

### Web Version (No Installation)
1. **Start the Bridge Server** (Required for full functionality):
   ```bash
   cd bridge
   npm install
   npm run manager  # Recommended: uses bridge manager for auto-restart
   # OR
   npm start  # Direct start
   ```

2. Open the web terminal in your browser
3. The terminal automatically:
   - Tries to connect to external bridge (if available)
   - Falls back to WebVM (browser-based)
   - Initializes AI assistant
   - Works immediately!

### With Bridge Server (Full System Access)
1. Start the bridge server:
   ```bash
   cd bridge
   npm install
   npm start
   ```
2. Open the web terminal - it will auto-connect
3. Enjoy full system command execution!

## 📦 Architecture

### Enhanced Bridge System
The terminal uses a sophisticated bridge system with automatic fallback:

1. **External Bridge** (Preferred)
   - Node.js server running locally
   - Full system command execution
   - Real filesystem access
   - WebSocket for real-time I/O

2. **WebVM Bridge** (Fallback)
   - Runs entirely in browser
   - Limited command set
   - Virtual filesystem
   - Always available

3. **Automatic Fallback**
   - Tries external bridge first
   - Falls back to WebVM if unavailable
   - Seamless switching between modes

## ⌨️ Keyboard Shortcuts

- `Ctrl+P` - Command palette
- `Ctrl+E` - Toggle file manager
- `Ctrl+B` - Toggle browser automation panel
- `Ctrl+T` - New terminal tab
- `Ctrl+W` - Close current tab
- `Ctrl+Shift+P` - AI assistant
- `Ctrl+K` - Clear terminal
- `Ctrl+L` - Clear screen

## 📋 Commands

### Built-in Commands
- `help` - Show help message
- `clear` - Clear terminal screen
- `exit` - Close terminal tab
- `tabs` - List all tabs
- `newtab` - Create new tab
- `closetab <n>` - Close tab by number
- `switchtab <n>` - Switch to tab by number
- `share` - Copy session share link

### Integration Commands

All integrations use the "leaf" prefix for shorter command names:

- `leafup` - Development environment setup tool
  - `leafup init [toml|hcl]` - Initialize configuration
  - `leafup install <packages>` - Install development packages
  - `leafup search <query>` - Search nixpkgs repository
  - `leafup status` - Show leafup status
  - **Description**: Leafup provides a streamlined way to set up and manage development environments across different platforms. It uses Nix-based package management to ensure consistent environments and easy package installation.

- `leaflinux` - ChromeOS Linux container setup (ChromeOS only)
  - `leaflinux init` - Quick development setup
  - `leaflinux desktop` - Install desktop environment
  - `leaflinux status` - Check container status
  - **Description**: Leaf Linux provides tools to quickly set up and manage the ChromeOS Linux container (Crostini). It automates the installation of development tools, desktop environments, and common packages for a productive Linux environment.

- `leafrecovery` - ChromeOS recovery/modding tools (ChromeOS only)
  - `leafrecovery info` - Device information
  - `leafrecovery recovery` - Recovery mode status
  - `leafrecovery firmware` - Firmware information
  - `leafrecovery partitions` - Partition information
  - **Description**: Leaf Recovery provides access to ChromeOS recovery and modding tools, allowing you to check device information, firmware details, recovery mode status, and partition information. Essential for ChromeOS developers and power users.

- `leafvm` / `leaf-box` - VirtualBox VM management
  - `leafvm list` - List all VMs
  - `leafvm start <vm>` - Start a VM
  - `leafvm stop <vm>` - Stop a VM
  - **Description**: Leaf VM provides a command-line interface to manage VirtualBox virtual machines. Create, start, stop, and manage VMs directly from the terminal. Perfect for running multiple operating systems, testing environments, or isolated development setups.

- `leafemu` - x86 emulator (browser-based)
  - `leafemu status` - Check Leaf Emulator availability
  - **Description**: Leaf Emulator brings full x86 PC emulation to your browser. Run legacy operating systems, test software in isolated environments, or explore classic computing platforms - all without leaving your browser.

- `leafpod` - BrowserPod container runtime (Python, etc.)
  - `leafpod create [image]` - Create container
  - `leafpod list` - List all containers
  - `leafpod exec <containerId> <command>` - Execute command in container
  - `leafpod python <containerId> <code>` - Run Python code
  - `leafpod stop <containerId>` - Stop container
  - `leafpod remove <containerId>` - Remove container
  - `leafpod logs <containerId>` - Get container logs
  - `leafpod status` - Show status
  - **Description**: Leaf Pod enables running containerized applications directly in your browser. Execute Python scripts, run Node.js applications, or deploy any containerized workload - all without leaving the browser. Perfect for web-based development and testing environments.

- `leafpuppeteer` - Browser automation with Puppeteer
  - `leafpuppeteer launch [gui]` - Launch browser (headless or GUI)
  - `leafpuppeteer list` - List all browsers
  - `leafpuppeteer pages` - List all pages
  - `leafpuppeteer page create <browserId>` - Create new page
  - `leafpuppeteer page navigate <pageId> <url>` - Navigate to URL
  - `leafpuppeteer page screenshot <pageId>` - Take screenshot
  - `leafpuppeteer click <pageId> <selector>` - Click element
  - `leafpuppeteer type <pageId> <selector> <text>` - Type text
  - `leafpuppeteer eval <pageId> <script>` - Evaluate JavaScript
  - `leafpuppeteer analyze <pageId>` - Analyze page performance
  - `leafpuppeteer seo <pageId>` - Extract SEO data
  - `leafpuppeteer accessibility <pageId>` - Test accessibility
  - `leafpuppeteer scrape <pageId> <selectors>` - Scrape data with CSS selectors
  - `leafpuppeteer content <pageId>` - Extract structured content
  - `leafpuppeteer report <pageId>` - Generate comprehensive page report
  - `leafpuppeteer fill <pageId> <formData>` - Fill form automatically
  - `leafpuppeteer status` - Show status
  - **Description**: Leaf Puppeteer provides powerful browser automation capabilities. Control headless or GUI browsers, navigate pages, take screenshots, scrape data, test accessibility, analyze performance, and much more. Perfect for web testing, scraping, and automation tasks.

## 🔒 Security

- Bridge server runs on localhost only (default)
- All commands execute with user privileges
- No remote code execution
- Secure credential management for root operations

## 📝 License

See LICENSE file for details.

## 🔌 Integrations

Azalea Terminal integrates with several powerful tools and services:

### Development Tools
- **[Leafup](https://github.com/tsirysndr/crosup)** (based on crosup) - Quick development environment setup for Chromebook/ChromeOS, macOS, and Linux
- **[Leaf Linux](https://github.com/francis-chris5/Chrostini-Initializers)** (based on Chrostini-Initializers) - Rapid ChromeOS Linux container setup scripts

### Virtualization
- **[Leaf VM](https://github.com/VirtualBox/virtualbox)** (based on VirtualBox) - Virtual machine management
- **[Leaf Emulator](https://github.com/copy/v86)** (based on v86) - x86 PC emulator running in the browser
- **[Leaf Pod](https://github.com/leaningtech/browserpod-meta)** (based on BrowserPod) - Browser-based container runtime for Python and other applications
- **[Leaf Puppeteer](https://github.com/puppeteer/puppeteer)** (based on Puppeteer) - Browser automation

### ChromeOS Tools
- **[Leaf Recovery](https://github.com/MercuryWorkshop/RecoMod)** (based on RecoMod) - ChromeOS recovery and modding tools

All integrations are accessible via terminal commands and work seamlessly with the bridge backend.

## 🙏 Acknowledgments

- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [WebLLM](https://webllm.mlc.ai/) - Browser-based AI inference
- [BrowserPod](https://github.com/leaningtech/browserpod-meta) - Inspiration for in-browser runtime (integrated as Leaf Pod)
- [Puppeteer](https://github.com/puppeteer/puppeteer) - Browser automation library
- [crosup](https://github.com/tsirysndr/crosup) - Development environment setup (integrated as Leafup)
- [v86](https://github.com/copy/v86) - x86 emulation in browser (integrated as Leaf Emulator)

## 🐛 Troubleshooting

### Terminal Not Loading
- Check browser console for errors
- Ensure JavaScript is enabled
- Try a different browser

### Bridge Not Connecting
- Ensure bridge server is running (`npm start` in bridge directory)
- Check firewall settings
- Verify port 8765 is not in use
- Check bridge logs: `tail -f /tmp/azalea-bridge.log`

### Commands Not Working
- Ensure bridge backend is connected (check status indicator)
- Try reconnecting: refresh page
- Check browser console for errors

## 📦 Repository

Azalea Terminal is available at:
- **Primary**: https://github.com/xtoazt/azalea
- **Organization**: https://github.com/xazalea/azalea

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
