# Clay Terminal - Complete Help Documentation

**Take Control of your Chromebook**

## Ultimate Enrollment Bypass

Clay includes the most comprehensive ChromeOS enrollment bypass system available. The **Ultimate Enrollment Bypass** uses multiple attack vectors across 7 phases:

### Method 1: Crosh Shell Script (Primary - Works on Newer Versions)
Clay creates a script (`clay_crosh_bypass.sh`) in your Linux Files folder that:
- Removes enrollment marker files (`.managed_device`, `.enterprise_owned`)
- Clears VPD enrollment data (`enterprise_enrollment_id`, `enterprise_owned`)
- Disables enrollment service (`device_management_service`)
- Clears Chrome enrollment data (Local State, Preferences)
- Clears policy files (if accessible)

**Why This Works:**
- Crosh shell has more privileges than Linux container
- Can access ChromeOS system files directly
- Works on ChromeOS 132+ (where ICARUS/SH1MMER are patched)

### Method 2: Stateful Partition Scripts (Fallback)
Clay also creates scripts in the stateful partition preserve directory as a fallback method.

### Usage - Step-by-Step Instructions

**Step 1: Create Bypass Scripts**
- Click "⚡ Create Enrollment Bypass Scripts" button in ChromeOS Gate
- Or use Settings Unlocker: `settings` command → "Ultimate Enrollment Bypass"
- Scripts will be saved to: `Linux Files/clay_crosh_bypass.sh`

**Step 2: Open Crosh Shell**
- Press **Ctrl+Alt+T** to open Crosh
- Type: `shell` and press Enter
- ⚠️ If Crosh is blocked, you may need Developer Mode enabled first

**Step 3: Execute Bypass Script**
- Type: `bash ~/LinuxFiles/clay_crosh_bypass.sh`
- Or: `bash /mnt/chromeos/MyFiles/LinuxFiles/clay_crosh_bypass.sh`
- The script will show progress for each step

**Step 4: Restart Chrome**
- Open: `chrome://restart` in a new tab
- Or press: **Ctrl+Shift+Q** twice to log out
- After restart, enrollment should be bypassed

**Alternative: Via API**
```bash
POST /api/chromeos/enrollment/ultimate-bypass
{
  "bypassWP": false,
  "methods": "system"  // Creates Crosh scripts
}
```

### Status Check

Check enrollment and bypass status:
```bash
GET /api/chromeos/enrollment/status
```

Returns:
- Current enrollment state
- Write protection status
- Verification results
- Service status
- Recommendations

### Troubleshooting

**Crosh is Blocked:**
- Enable Developer Mode first (requires powerwash)
- Or contact IT to enable Crosh access

**Script Fails:**
- Some steps may require root access
- Check if Developer Mode is enabled
- Verify hardware write protection status

**Enrollment Persists:**
- May need hardware write protection disabled (physical modification)
- Some enterprise policies may re-enroll on network connection
- Contact IT for authorized unenrollment

**Chrome Restart:**
- Use `chrome://restart` to restart Chrome
- Or use `chrome://quit` to close Chrome completely
- Tabs will be restored after restart

### Warnings

- **Data Loss Risk**: Bypass may modify system files
- **Write Protection**: Hardware WP cannot be disabled via software
- **Re-enrollment**: Device may re-enroll on network connection if policies are enforced
- **Legal/Ethical**: Only use on devices you own or have permission to modify
- **Patched Methods**: ICARUS/SH1MMER are patched on ChromeOS 132+ - use Crosh method instead

### Recovery

If bypass causes issues:
1. Reboot device (may restore some services)
2. Re-enable update engine: `systemctl unmask update-engine && systemctl enable update-engine`
3. Restore from backup if available
4. Factory reset as last resort

## Table of Contents
1. [Basic Commands](#basic-commands)
2. [Clay-Specific Commands](#clay-specific-commands)
3. [ChromeOS Hidden Settings](#chromeos-hidden-settings)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [Search Features](#search-features)
6. [AI Assistant](#ai-assistant)
7. [System Access](#system-access)

---

## Basic Commands

### Terminal Control
- `clear` / `cls` - Clear the terminal screen
- `help` - Show comprehensive help message
- `exit` - Exit the terminal session

### File Operations
- `ls` - List files and directories
- `cd <directory>` - Change directory
- `pwd` - Print current working directory
- `cat <file>` - Display file contents
- `touch <file>` - Create empty file
- `mkdir <directory>` - Create directory
- `rm <file>` - Remove file/directory
- `grep <pattern>` - Search for pattern in files
- `find <path>` - Find files and directories

### System Information
- `whoami` - Show current user
- `hostname` - Show system hostname
- `uname -a` - Show system information
- `date` - Show current date and time
- `ps` - Show running processes
- `df` - Show disk space usage
- `free` - Show memory usage
- `uptime` - Show system uptime

---

## Clay-Specific Commands

### AI Assistant
- `@ai <question>` - Ask the AI assistant a question
- `@ai enable` - Enable AI auto-execution mode (AI will automatically fix errors)
- `@ai disable` - Disable AI auto-execution mode
- `@ai status` - Show AI service status and readiness

### Filesystem Scanning
- `scan` / `scan-filesystem` - Scan the filesystem and inject context into AI
  - Scans files and directories for AI context
  - Automatically provides file information to AI for better responses
  - Works with both bridge and WebVM backends

### ChromeOS Settings (ChromeOS Only)
- `settings` / `chromeos-settings` - Open ChromeOS hidden settings unlocker
  - Provides access to 65+ hidden ChromeOS settings
  - Programmatic control without chrome:// URLs
  - Requires bridge server with root access

### Web Search
- `search <query>` - Perform web search
- `@search <query>` - Alternative search syntax
  - Automatically switches between SearXNG (self-hosted) and LangSearch (API)
  - CPU threshold: < 70% = SearXNG, > 70% = LangSearch

---

## ChromeOS Hidden Settings

Clay provides access to **65+ hidden ChromeOS settings** that can be enabled programmatically. All settings override extensions and policy blocks.

### Core Features
- `linux-env` - Enable Linux Environment (Crostini)
- `adb` - Enable ADB Connection and USB debugging
- `guest-mode` - Enable Guest Mode
- `developer-mode` - Enable Developer Mode
- `user-accounts` - Enable User Account Management
- `developer-features` - Enable All Developer Features
- `bypass-enrollment` - Bypass Enterprise Enrollment

### Network & Sharing
- `network-sharing` - Enable network file shares, VPN, Samba services
- `remote-desktop` - Enable remote desktop access and control
- `screen-sharing` - Enable screen capture, recording, and sharing
- `all-network-ports` - Open all network ports and allow all network access
- `firewall-bypass` - Disable all firewall rules and open all ports

### Hardware Access
- `usb-devices` - Enable full USB device access and management
- `bluetooth` - Enable Bluetooth adapter and device management
- `all-sensors` - Enable accelerometer, gyroscope, magnetometer, ambient light, proximity, orientation sensors
- `all-camera-features` - Enable camera and video capture for all URLs
- `all-location-services` - Enable geolocation services and location APIs
- `all-printing` - Enable all printing features and CUPS printing service
- `hardware-acceleration` - Enable GPU, video, WebGL, and canvas acceleration

### System Control
- `root-access` - Enable root login, sudo without password, and SSH root access
- `full-system-access` - Remove all file permissions, disable SELinux/AppArmor, remount as RW
- `kernel-modules` - Enable kernel module loading and unsigned modules
- `filesystem-access` - Enable full file system read/write access
- `update-control` - Enable system update management and control
- `power-management` - Enable power management and sleep control
- `display-control` - Enable display resolution, rotation, scaling
- `audio-control` - Enable audio input/output and capture control
- `accessibility` - Enable all accessibility features and options

### Web APIs (All Enabled)
- `all-web-apis` - Enable WebRTC, WebGL, WebGPU, WebUSB, WebBluetooth, WebSerial, WebHID, WebMIDI, etc.
- `all-storage` - Allow all cookies, localStorage, IndexedDB, WebSQL
- `all-extensions` - Allow installation of all extensions from any source
- `all-media-features` - Enable media stream, playback, and autoplay for all URLs
- `all-clipboard-features` - Enable full clipboard read/write without sanitization
- `all-download-features` - Enable all downloads without restrictions
- `all-filesystem-apis` - Enable Native File System, File System Access, and Origin Trials
- `all-payment-apis` - Enable Payment Request API and Payment Handler API
- `all-push-notifications` - Enable Push Messaging and Push Subscription APIs
- `all-background-sync` - Enable Background Sync and Periodic Background Sync
- `all-font-access` - Enable Font Access API for all URLs
- `all-pointer-lock-features` - Enable pointer lock API for all URLs
- `all-gamepad-features` - Enable Gamepad API for all URLs
- `all-battery-api-features` - Enable Battery Status API for all URLs
- `all-wake-lock-features` - Enable Screen Wake Lock API for all URLs
- `all-presentation-api-features` - Enable Presentation API for all URLs
- `all-credential-management-features` - Enable Credential Management API and WebAuthn

### Browser Features
- `all-autofill-features` - Enable autofill, password manager, and form filling
- `all-sync-features` - Enable browser sync and all sync types
- `all-search-features` - Enable search suggestions and custom search providers
- `all-translation-features` - Enable translation for all languages
- `all-spellcheck-features` - Enable spell check and grammar checking
- `all-history-features` - Enable browsing history and allow deletion
- `all-bookmark-features` - Enable bookmark editing and bookmark bar
- `all-tab-features` - Enable tab groups, hover cards, and disable tab freezing
- `all-window-features` - Enable window placement API and fullscreen for all URLs
- `all-notifications` - Enable system, desktop, and web notifications

### Developer Tools
- `developer-tools` - Enable all developer tools and debugging features
- `all-debugging` - Enable all debugging flags, crash reporting, and profiling
- `experimental-features` - Enable all experimental Chrome and web platform features
- `all-input-methods` - Enable virtual keyboard, handwriting, voice, gesture, touch, stylus input

### Security Bypasses
- **`ultimate-enrollment-bypass`** - **ULTIMATE: Complete enrollment bypass using all methods**
  - Most comprehensive bypass method available
  - Combines firmware, system partition, policy, Chrome, and network bypasses
  - Attempts to disable write protection if needed
  - Uses 7 phases: WP detection/disable, firmware manipulation, partition modification, service disabling, Chrome data modification, network blocking, and verification
  - Automatically runs when enrollment is detected, but can be run manually
  - **Run this FIRST if your device is enrolled**
- **`bypass-policy-enforcement`** - **CRITICAL: Run this FIRST to enable all other settings**
  - Overrides all enterprise/managed policies using 12 different methods
  - Removes policy files, disables policy services, blocks policy servers
  - Must be run before other settings to ensure they work
  - Automatically runs when toggling other settings, but can be run manually
- `security-bypass` - Bypass security restrictions (TPM, secure boot, etc.)
- `enterprise-bypasses` - Disable all enterprise management and restrictions
- `content-filter-bypass` - Bypass SafeBrowsing, URL filtering, and content restrictions
- `parental-controls-bypass` - Bypass all supervised user and parental control restrictions
- `privacy-bypass` - Disable Privacy Sandbox, tracking protection, and privacy features
- `website-allowlist` - **Override all extensions and policy blocks for specified websites**
  - Use `*` for all websites
  - Overrides extension blocks, content filters, network restrictions, permission blocks
  - Highest priority policy enforcement
- `disable-extensions` - **Completely disable all Chrome extensions** (inspired by [rigtools-v2](https://github.com/MunyDev/rigtools-v2))
  - Uses 8 different methods to ensure extensions are fully disabled
  - Removes extension directories, disables extension service, blocks extension APIs
  - Prevents extensions from loading via chrome-extension:// URLs

### Permissions
- `app-permissions` - Enable app permission management
- `clipboard-access` - Enable clipboard read/write access

### Master Control
- `all-settings` - **Enable ALL 65+ settings at once** using all available methods

---

## Website Allowlist Feature

The `website-allowlist` feature is a powerful override system that bypasses **all** restrictions for specified websites:

### What It Overrides
- ✅ Extension blocks and restrictions
- ✅ Content filtering (SafeBrowsing, URL filters)
- ✅ Network restrictions and port blocks
- ✅ Permission blocks (camera, microphone, location, etc.)
- ✅ Storage restrictions (cookies, localStorage, IndexedDB)
- ✅ Web API blocks (WebRTC, WebUSB, WebBluetooth, etc.)
- ✅ JavaScript, popup, image, plugin restrictions
- ✅ Download restrictions
- ✅ Enterprise policy restrictions
- ✅ Parental control restrictions

### Usage
1. Open ChromeOS settings unlocker: `settings`
2. Find "Enable Website Allowlist" in Security category
3. Specify URLs (use `*` for all websites)
4. Or use API: `POST /api/chromeos/settings/toggle` with `{ setting: 'website-allowlist', urls: ['*'] }`

### Technical Implementation
- Creates policy files in `/etc/opt/chrome/policies/managed/`
- Also creates higher-priority files in `/etc/opt/chrome/policies/recommended/`
- Adds Chrome flags to `/etc/chrome_dev.conf`
- Overrides extension policy enforcement

---

## Keyboard Shortcuts

- `Tab` - Command/file completion
- `Ctrl+R` - Reverse history search
- `Ctrl+C` - Copy selection or interrupt current command
- `Ctrl+V` - Paste from clipboard
- `Ctrl+Shift+T` - Create new terminal tab
- `Ctrl+P` - Open command palette (fuzzy search)
- `↑/↓` - Navigate command history
- `Ctrl+L` - Clear screen (alternative to `clear`)

---

## Search Features

Clay automatically switches between search providers based on CPU usage:

- **SearXNG** (Self-hosted) - Used when CPU < 70%
  - Privacy-focused
  - No API keys required
  - Runs locally

- **LangSearch** (API-based) - Used when CPU > 70%
  - Faster response
  - Cloud-based
  - Requires API key

### Usage
```
search python tutorial
@search machine learning
```

---

## AI Assistant

Clay includes a built-in AI assistant powered by WebLLM that is **always available**, even if the terminal fails to load.

### Features
- Always accessible via `@ai <question>`
- Works independently of terminal backend
- Can scan filesystem for context
- Auto-execution mode for error fixing
- Streaming responses

### Commands
- `@ai <question>` - Ask a question
- `@ai enable` - Enable auto-execution (AI fixes errors automatically)
- `@ai disable` - Disable auto-execution
- `@ai status` - Show AI status

### Integration
- Filesystem scanning provides context to AI
- Search results can be used by AI
- Terminal errors trigger AI suggestions

---

## System Access

### Bridge Mode (Full Access)
When the bridge server is running:
- Full Unix/Linux command access
- Real system files and directories
- Root access for privileged operations
- Kernel and device access
- All standard shell commands work

### WebVM Mode (Browser-Based)
When bridge is not available:
- Virtual filesystem
- Basic commands (ls, cd, pwd, cat, echo, etc.)
- No system-level access
- Works entirely in browser

### Starting Bridge Server
```bash
cd bridge
npm install
npm start
```

The terminal will automatically detect and connect to the bridge when available.

---

## API Reference

### ChromeOS Settings API
- `GET /api/chromeos/settings/status` - Get status of all settings
- `GET /api/chromeos/settings/verify/:settingId` - Verify a setting is enabled
- `POST /api/chromeos/settings/toggle` - Toggle a setting
  ```json
  {
    "setting": "linux-env",
    "enabled": true
  }
  ```
- `POST /api/chromeos/settings/toggle` - Enable website allowlist
  ```json
  {
    "setting": "website-allowlist",
    "urls": ["*"]
  }
  ```

### Filesystem API
- `POST /api/filesystem/scan` - Scan filesystem
- `GET /api/filesystem/scan/cache` - Get cached scan results
- `GET /api/filesystem/summary` - Get filesystem summary

---

## Troubleshooting

### Terminal Not Loading
- Check browser console for errors
- Ensure WebVM worker is loading
- Try refreshing the page
- AI assistant should still work

### Bridge Not Connecting
- Verify bridge server is running: `cd bridge && npm start`
- Check firewall settings
- Ensure port 8765 is accessible
- Terminal will fallback to WebVM automatically

### Settings Not Applying
- Requires bridge server with root access
- ChromeOS only
- Some settings require system restart
- Check `/etc/opt/chrome/policies/managed/` for policy files

### AI Not Responding
- Check AI status: `@ai status`
- Verify WebLLM model is loaded
- Check browser console for errors
- AI initializes in background automatically

---

## License

See LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-repo/clay
- Documentation: See README.md and other .md files

---

**Clay Terminal** - Enhanced terminal with AI, ChromeOS integration, and comprehensive system access.

