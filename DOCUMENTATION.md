# Clay Terminal - Documentation Index

Welcome to Clay Terminal documentation! This guide will help you find the right documentation for your needs.

## 📚 Documentation Files

### For End Users (Web App)

- **[README.md](./README.md)** - Main project documentation
  - Quick start guide
  - Web app setup
  - Bridge server setup
  - Features overview

### For Developers (NPM Package)

- **[README-PACKAGE.md](./README-PACKAGE.md)** - NPM Package Documentation
  - Package installation
  - API reference
  - Complete feature list
  - Configuration options

- **[INTEGRATION.md](./INTEGRATION.md)** - Integration Guide
  - React integration examples
  - Vue integration examples
  - Next.js integration examples
  - Svelte integration examples
  - Plain HTML/JavaScript examples
  - Advanced configuration

- **[PACKAGE-SETUP.md](./PACKAGE-SETUP.md)** - Package Development Guide
  - Package structure
  - Building the package
  - Publishing to NPM
  - Development workflow

### For Backend Setup

- **[bridge/README.md](./bridge/README.md)** - Bridge Server Documentation
  - Bridge server setup
  - Real system access
  - Auto-start configuration
  - API endpoints

## 🎯 Quick Navigation

### I want to...

**Use the web app:**
→ Start with [README.md](./README.md)

**Integrate into my project:**
→ Read [README-PACKAGE.md](./README-PACKAGE.md) then [INTEGRATION.md](./INTEGRATION.md)

**Set up real system access:**
→ See [bridge/README.md](./bridge/README.md)

**Build/develop the package:**
→ Check [PACKAGE-SETUP.md](./PACKAGE-SETUP.md)

**Share terminal sessions:**
→ See [README-PACKAGE.md](./README-PACKAGE.md#session-sharing)

## 📖 Package Quick Reference

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

```typescript
const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  bridgeUrl: 'ws://127.0.0.1:8765/ws'
});
```

## 🔗 External Resources

- [xterm.js Documentation](https://xtermjs.org/)
- [Catppuccin Theme](https://catppuccin.com/)
- [Hyper Terminal](https://hyper.is/) - UI inspiration

## 💡 Common Questions

**Q: Can I use this on ChromeOS without Linux container?**
A: Yes! The browser-only mode works perfectly. For real system access, you'll need the Linux container and bridge server.

**Q: How do I integrate this into React?**
A: See [INTEGRATION.md - React Integration](./INTEGRATION.md#2-react-integration)

**Q: Can I customize the theme?**
A: Yes! See [README-PACKAGE.md - Custom Theme](./README-PACKAGE.md#custom-theme)

**Q: How do I share terminal sessions?**
A: See [README-PACKAGE.md - Session Sharing](./README-PACKAGE.md#session-sharing)

## 📧 Support

- GitHub Issues: [Open an issue](https://github.com/xtoazt/clay/issues)
- Documentation: Check the relevant guide above
- Examples: See `package/examples/` directory

---

**Happy coding! 🚀**

