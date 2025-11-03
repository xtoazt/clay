import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { CanvasAddon } from 'xterm-addon-canvas';
import { BridgeBackend } from './bridge-backend';
import { WebWorkerBackendWrapper } from './backend-worker-wrapper';
import { SessionEncoder } from './session-encoder';

// Helper to get hostname (fallback for browser)
function getHostname(): string {
  return typeof window !== 'undefined' ? window.location.hostname : 'localhost';
}

// Detect ChromeOS
function isChromeOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  // Check user agent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('cros') || ua.includes('chromeos')) {
    return true;
  }
  
  // Check for ChromeOS-specific properties
  if ((navigator as any).userAgentData?.platform === 'Chrome OS') {
    return true;
  }
  
  // Check for ChromeOS-specific APIs
  if (typeof (window as any).chrome !== 'undefined' && 
      (window as any).chrome.runtime && 
      (window as any).chrome.runtime.id) {
    // Additional check: ChromeOS typically has specific capabilities
    const platform = navigator.platform.toLowerCase();
    return platform.includes('linux') && ua.includes('chrome') && !ua.includes('android');
  }
  
  return false;
}

class ClayWebTerminal {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private backend: BridgeBackend | WebWorkerBackendWrapper | null = null;
  private isConnected: boolean = false;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentLine: string = '';
  private aiAssistant: SimpleAIAssistant;
  private currentDirectory: string = '';
  private lastError: { command: string; output: string; timestamp: number } | null = null;
  private aiControlEnabled: boolean = false;
  private aiExecuting: boolean = false;
  private useBridge: boolean = false;
  private sessionCommands: string[] = []; // Track all commands for sharing
  private isReplayingSession: boolean = false;
  private isChromeOS: boolean = false;
  private webvmStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  private websocketStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  private bridgeStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';

  constructor() {
    this.terminal = new Terminal({
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#cba6f7',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#89dceb',
        white: '#cdd6f4',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#89dceb',
        brightWhite: '#f5e0dc'
      },
      fontSize: 13,
      fontFamily: '"SF Mono", "Menlo", "Monaco", "DejaVu Sans Mono", "Lucida Console", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      lineHeight: 1.6,
      letterSpacing: 0.3
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());
    this.terminal.loadAddon(new CanvasAddon());

    this.aiAssistant = new SimpleAIAssistant();
    this.isChromeOS = isChromeOS();
    
    // Try to connect to bridge first (real system access), fallback to Web Worker
    this.initializeBackend();

    // Expose to window for UI access
    (window as any).clayTerminal = this;

    this.initializeTerminal();
    this.setupBackend();
    this.initializeStatusBar();
    this.checkForShareLink();
    
    // Initialize Lucide icons
    if (typeof (window as any).lucide !== 'undefined') {
      (window as any).lucide.createIcons();
    }
  }

  private checkForShareLink(): void {
    // Check if URL has a share link
    const commands = SessionEncoder.parseShareUrl();
    if (commands.length > 0) {
      this.terminal.write(`\r\n\x1b[33m[Share Link Detected]\x1b[0m Found ${commands.length} command(s) to replay\r\n`);
      this.terminal.write(`\x1b[36m[Replaying]\x1b[0m Starting session replay...\r\n\r\n`);
      
      // Wait for backend to be ready, then replay
      setTimeout(async () => {
        await this.replaySession(commands);
      }, 1000);
    }
  }

  private async replaySession(commands: string[]): Promise<void> {
    this.isReplayingSession = true;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      this.terminal.write(`\x1b[33m[${i + 1}/${commands.length}]\x1b[0m ${command}\r\n`);
      
      // Execute command
      if (this.isConnected && this.backend && this.backend.getConnected()) {
        this.backend.sendInput(command + '\r\n');
      } else {
        await this.executeCommand(command);
      }
      
      // Small delay between commands
      if (i < commands.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    
    this.terminal.write(`\r\n\x1b[32m[Replay Complete]\x1b[0m Session replay finished\r\n`);
    this.isReplayingSession = false;
  }

  public generateShareLink(): string {
    if (this.sessionCommands.length === 0) {
      return '';
    }
    return SessionEncoder.generateShareUrl(this.sessionCommands);
  }

  public async copyShareLink(): Promise<void> {
    const shareLink = this.generateShareLink();
    if (!shareLink) {
      this.terminal.write(`\r\n\x1b[33m[Share]\x1b[0m No commands to share yet\r\n`);
      if (!this.useBridge) {
        this.writePrompt();
      }
      return;
    }
    
    try {
      await navigator.clipboard.writeText(shareLink);
      this.terminal.write(`\r\n\x1b[32m[Share Link Copied!]\x1b[0m\r\n`);
      this.terminal.write(`\x1b[36m${shareLink}\x1b[0m\r\n`);
      this.terminal.write(`\x1b[33m[Share]\x1b[0m Link includes ${this.sessionCommands.length} command(s)\r\n`);
      if (!this.useBridge) {
        this.writePrompt();
      }
    } catch (error) {
      this.terminal.write(`\r\n\x1b[31m[Error]\x1b[0m Failed to copy share link: ${error}\r\n`);
      if (!this.useBridge) {
        this.writePrompt();
      }
    }
  }

  private initializeStatusBar(): void {
    // Show/hide bridge status based on ChromeOS
    const bridgeStatusEl = document.getElementById('bridge-status');
    const websocketStatusEl = document.getElementById('websocket-status');
    
    if (this.isChromeOS) {
      if (bridgeStatusEl) bridgeStatusEl.style.display = 'flex';
      if (websocketStatusEl) websocketStatusEl.style.display = 'flex';
    } else {
      if (bridgeStatusEl) bridgeStatusEl.style.display = 'none';
      if (websocketStatusEl) websocketStatusEl.style.display = 'none';
    }
    
    // Update status indicators
    this.updateWebVMStatus('connecting');
    this.updateWebSocketStatus('disconnected');
    this.updateBridgeStatus('disconnected');
    this.updateAIStatus('idle');
    
    // Periodically check backend status
    setInterval(() => {
      this.checkBackendComponents();
    }, 2000);
  }
  
  private checkBackendComponents(): void {
    if (this.backend) {
      if (this.backend instanceof BridgeBackend) {
        // Bridge backend
        const ws = (this.backend as any).ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          this.updateWebSocketStatus('connected');
          this.updateBridgeStatus('connected');
          this.updateWebVMStatus('disconnected'); // Not using WebVM when bridge is active
        } else if (ws && ws.readyState === WebSocket.CONNECTING) {
          this.updateWebSocketStatus('connecting');
          this.updateBridgeStatus('connecting');
        } else {
          this.updateWebSocketStatus('disconnected');
          this.updateBridgeStatus('disconnected');
        }
      } else if (this.backend instanceof WebWorkerBackendWrapper) {
        // Web Worker backend (WebVM)
        if (this.backend.getConnected()) {
          this.updateWebVMStatus('connected');
          this.updateWebSocketStatus('disconnected');
          this.updateBridgeStatus('disconnected');
        } else {
          this.updateWebVMStatus('disconnected');
        }
      }
    } else {
      this.updateWebVMStatus('disconnected');
      this.updateWebSocketStatus('disconnected');
      this.updateBridgeStatus('disconnected');
    }
    
    // Refresh Lucide icons
    if (typeof (window as any).lucide !== 'undefined') {
      (window as any).lucide.createIcons();
    }
  }

  private updateWebVMStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
    this.webvmStatus = status;
    const dot = document.getElementById('webvm-dot');
    const text = document.getElementById('webvm-text');
    
    if (dot && text) {
      dot.className = 'status-dot';
      switch (status) {
        case 'connected':
          dot.classList.add('connected');
          text.textContent = 'WebVM';
          break;
        case 'disconnected':
          dot.classList.add('disconnected');
          text.textContent = 'WebVM';
          break;
        case 'connecting':
          dot.classList.add('connecting');
          text.textContent = 'WebVM...';
          break;
        case 'error':
          dot.classList.add('error');
          text.textContent = 'WebVM';
          break;
      }
    }
  }
  
  private updateWebSocketStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
    this.websocketStatus = status;
    const dot = document.getElementById('websocket-dot');
    const text = document.getElementById('websocket-text');
    
    if (dot && text) {
      dot.className = 'status-dot';
      switch (status) {
        case 'connected':
          dot.classList.add('connected');
          text.textContent = 'WS';
          break;
        case 'disconnected':
          dot.classList.add('disconnected');
          text.textContent = 'WS';
          break;
        case 'connecting':
          dot.classList.add('connecting');
          text.textContent = 'WS...';
          break;
        case 'error':
          dot.classList.add('error');
          text.textContent = 'WS';
          break;
      }
    }
  }
  
  private updateBridgeStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
    this.bridgeStatus = status;
    const dot = document.getElementById('bridge-dot');
    const text = document.getElementById('bridge-text');
    
    if (dot && text) {
      dot.className = 'status-dot';
      switch (status) {
        case 'connected':
          dot.classList.add('connected');
          text.textContent = 'Bridge';
          break;
        case 'disconnected':
          dot.classList.add('disconnected');
          text.textContent = 'Bridge';
          break;
        case 'connecting':
          dot.classList.add('connecting');
          text.textContent = 'Bridge...';
          break;
        case 'error':
          dot.classList.add('error');
          text.textContent = 'Bridge';
          break;
      }
    }
  }

  private updateAIStatus(status: 'ready' | 'idle' | 'thinking' | 'error'): void {
    const dot = document.getElementById('ai-dot');
    const text = document.getElementById('ai-text');
    
    if (dot && text) {
      dot.className = 'status-dot';
      switch (status) {
        case 'ready':
          dot.classList.add('connected');
          text.textContent = 'AI Ready';
          break;
        case 'idle':
          dot.classList.add('disconnected');
          text.textContent = 'AI Idle';
          break;
        case 'thinking':
          dot.classList.add('connecting');
          text.textContent = 'AI Thinking...';
          break;
        case 'error':
          dot.classList.add('error');
          text.textContent = 'AI Error';
          break;
      }
    }
  }

  private initializeTerminal(): void {
    const terminalElement = document.getElementById('terminal');
    if (!terminalElement) {
      throw new Error('Terminal element not found');
    }

    this.terminal.open(terminalElement);
    
    // Initial fit with a small delay to ensure proper rendering
    setTimeout(() => {
      this.fitAddon.fit();
    }, 100);

    // Handle window resize with debouncing
    let resizeTimeout: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.fitAddon.fit();
        // Resize terminal in backend
        if (this.backend && this.backend.getConnected()) {
          const dimensions = this.fitAddon.proposeDimensions();
          if (dimensions) {
            this.backend.resize(dimensions.cols, dimensions.rows);
          }
        }
      }, 150);
    });
    
    // Additional resize after a longer delay to catch any layout shifts
    setTimeout(() => {
      this.fitAddon.fit();
      if (this.backend && this.backend.getConnected()) {
        const dimensions = this.fitAddon.proposeDimensions();
        if (dimensions) {
          this.backend.resize(dimensions.cols, dimensions.rows);
        }
      }
    }, 500);

    // Handle keyboard input - send directly to backend
    this.terminal.onData((data: string) => {
      // Prevent default form submission behavior
      if (data === '\r' || data === '\n') {
        // Prevent any page scrolling or form submission
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: false, cancelable: true });
        event.preventDefault();
      }
      
      if (this.isConnected && this.backend && this.backend.getConnected()) {
        // Send directly to backend for real-time terminal
        this.backend.sendInput(data);
      } else {
        // Handle locally if not connected
        this.handleLocalCommand(data);
      }
    });
    
    // Prevent Enter key from causing page scroll
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        // Prevent default to stop page scrolling
        event.preventDefault();
        return false;
      }
      return true;
    });

    // Handle paste (Ctrl+V)
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          this.currentLine += text;
          this.terminal.write(text);
        }).catch(() => {});
        return false;
      }
      return true;
    });

    this.printWelcomeMessage();
  }

  private async initializeBackend(): Promise<void> {
    // On ChromeOS, try to auto-connect to bridge
    if (this.isChromeOS) {
      const bridge = new BridgeBackend();
      
      try {
        const isHealthy = await bridge.healthCheck();
        if (isHealthy) {
          console.log('[INFO] Bridge server found, using real system access');
          this.backend = bridge;
          this.useBridge = true;
          this.updateBridgeStatus('connecting');
          this.updateWebSocketStatus('connecting');
          return;
        }
      } catch (error) {
        console.log('[INFO] Bridge server not available');
      }
      
      // On ChromeOS, keep trying to connect in background
      this.updateBridgeStatus('disconnected');
      
      // Try connecting every 5 seconds on ChromeOS
      const bridgeRetryInterval = setInterval(async () => {
        if (!this.useBridge) {
          try {
            const bridge = new BridgeBackend();
            const isHealthy = await bridge.healthCheck();
            if (isHealthy) {
              console.log('[INFO] Bridge server found, switching to real system access');
              this.backend = bridge;
              this.useBridge = true;
              this.updateBridgeStatus('connecting');
              this.updateWebSocketStatus('connecting');
              await this.setupBackend();
              clearInterval(bridgeRetryInterval);
            }
          } catch (error) {
            // Continue trying
          }
        } else {
          clearInterval(bridgeRetryInterval);
        }
      }, 5000);
    }
    
    // Fallback to Web Worker (browser-only)
    this.backend = new WebWorkerBackendWrapper();
    this.useBridge = false;
    this.updateWebVMStatus('connecting');
  }

  private async setupBackend(): Promise<void> {
    if (!this.backend) {
      await this.initializeBackend();
    }
    
    try {
      if (this.useBridge) {
        this.terminal.write('\r\n\x1b[33m[INFO]\x1b[0m Connecting to Clay Terminal Bridge...\r\n');
        this.terminal.write('\x1b[32m[INFO]\x1b[0m Real system command execution enabled!\r\n');
      } else {
        this.terminal.write('\r\n\x1b[33m[INFO]\x1b[0m Initializing WebVM backend...\r\n');
        this.terminal.write('\x1b[33m[INFO]\x1b[0m Running in browser (limited commands)\r\n');
      }
      
      // Set up output handler
      this.backend!.onOutput((data: string) => {
        this.terminal.write(data);
      });
      
      this.backend!.onExit((code: number, signal: number) => {
        this.terminal.write(`\r\n\x1b[33m[Process exited]\x1b[0m Code: ${code}\r\n`);
        if (!this.useBridge) {
          this.writePrompt();
        }
      });
      
      this.backend!.onError((error: string) => {
        this.terminal.write(`\r\n\x1b[31m[Connection Error]\x1b[0m ${error}\r\n`);
      });
      
      // Connect to backend
      await this.backend!.connect();
      this.isConnected = true;
      
      if (this.useBridge) {
        this.updateBridgeStatus('connected');
        this.updateWebSocketStatus('connected');
        this.updateWebVMStatus('disconnected');
      } else {
        this.updateWebVMStatus('connected');
        this.updateWebSocketStatus('disconnected');
        this.updateBridgeStatus('disconnected');
      }
      
      // Get system info
      const info = await this.backend!.getSystemInfo();
      if (info) {
        this.currentDirectory = info?.homeDir || info?.cwd || (this.useBridge ? (info?.homeDir || '/') : '/home/user');
        this.terminal.write(`\x1b[32m[Connected]\x1b[0m Platform: ${info.platform}\r\n`);
        this.terminal.write(`\x1b[32m[Connected]\x1b[0m Shell: ${info.shell}\r\n`);
        if (this.useBridge) {
          this.terminal.write(`\x1b[32m[Connected]\x1b[0m Real system access: OK\r\n`);
          this.terminal.write(`\x1b[32m[Connected]\x1b[0m Full bash support: OK\r\n`);
        } else {
          this.terminal.write(`\x1b[32m[Connected]\x1b[0m Running in WebVM (browser)\r\n`);
        }
      } else {
        this.currentDirectory = this.useBridge ? (info?.homeDir || '/') : '/home/user';
      }
      
      if (this.useBridge) {
        this.terminal.write('\x1b[32m[INFO]\x1b[0m Bridge backend ready - Full system access!\r\n');
      } else {
        this.terminal.write('\x1b[32m[INFO]\x1b[0m WebVM backend ready!\r\n');
        this.terminal.write('\x1b[33m[Tip]\x1b[0m Start bridge server for real system access:\r\n');
        this.terminal.write('\x1b[33m[Tip]\x1b[0m   Run: ./start-bridge.sh\r\n');
        this.terminal.write('\x1b[33m[Tip]\x1b[0m   Or: cd bridge && npm start\r\n');
        this.terminal.write('\x1b[33m[Tip]\x1b[0m   Auto-start: cd bridge && npm run install-service\r\n');
      }
      
      this.hideLoading();
      if (!this.useBridge) {
        this.writePrompt();
      }
    } catch (error: any) {
      if (this.useBridge) {
        this.updateBridgeStatus('error');
        this.updateWebSocketStatus('error');
      } else {
        this.updateWebVMStatus('error');
      }
      this.terminal.write(`\x1b[31m[ERROR]\x1b[0m ${error.message}\r\n`);
      if (this.useBridge) {
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m Bridge connection failed\r\n`);
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m Make sure bridge server is running:\r\n`);
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m   Run: ./start-bridge.sh\r\n`);
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m   Or: cd bridge && npm start\r\n`);
      } else {
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m WebVM backend initialization failed\r\n`);
      }
      this.hideLoading();
      this.writePrompt();
    }
  }

  private handleLocalCommand(data: string): void {
    // Handle special keys
    if (data === '\r' || data === '\n') {
      // Enter pressed - prevent page scrolling
      this.terminal.write('\r\n');
      const command = this.currentLine.trim();
      
      if (command) {
        this.commandHistory.push(command);
        this.historyIndex = -1;
        this.executeCommand(command);
      } else {
        this.writePrompt();
      }
      
      this.currentLine = '';
    } else if (data === '\x7f' || data === '\b') {
      // Backspace
      if (this.currentLine.length > 0) {
        this.currentLine = this.currentLine.slice(0, -1);
        this.terminal.write('\b \b');
      }
    } else if (data === '\x1b[A') {
      // Arrow Up - History
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.currentLine = cmd;
        // Clear current line and rewrite
        this.terminal.write('\r\x1b[K');
        this.writePrompt();
        this.terminal.write(cmd);
      }
    } else if (data === '\x1b[B') {
      // Arrow Down - History
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.currentLine = cmd;
        this.terminal.write('\r\x1b[K');
        this.writePrompt();
        this.terminal.write(cmd);
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.currentLine = '';
        this.terminal.write('\r\x1b[K');
        this.writePrompt();
      }
    } else if (data.charCodeAt(0) === 3) {
      // Ctrl+C
      this.terminal.write('^C\r\n');
      this.currentLine = '';
      this.writePrompt();
    } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
      // Printable character
      this.currentLine += data;
      this.terminal.write(data);
    }
  }


  private async executeCommand(command: string): Promise<void> {
    // Handle built-in commands
    if (command === 'clear' || command === 'cls') {
      this.terminal.clear();
      this.writePrompt();
      return;
    }

    if (command === 'help') {
      this.terminal.write(`Available commands:\r\n`);
      this.terminal.write(`  clear, cls - Clear terminal\r\n`);
      this.terminal.write(`  help - Show this help\r\n`);
      this.terminal.write(`  @ai <question> - Ask AI assistant\r\n`);
      this.writePrompt();
      return;
    }

    if (command.startsWith('@ai ')) {
      const question = command.substring(4).trim();
      
      // Handle special AI commands
      if (question === 'enable') {
        this.aiControlEnabled = true;
        this.terminal.write(`\x1b[32m[AI]\x1b[0m AI control enabled - AI will auto-execute commands\r\n`);
        this.writePrompt();
        return;
      } else if (question === 'disable') {
        this.aiControlEnabled = false;
        this.terminal.write(`\x1b[33m[AI]\x1b[0m AI control disabled - manual execution required\r\n`);
        this.writePrompt();
        return;
      } else if (question === 'status') {
        this.terminal.write(`\x1b[36m[AI Status]\x1b[0m Control: ${this.aiControlEnabled ? 'ENABLED' : 'DISABLED'}\r\n`);
        this.terminal.write(`\x1b[36m[AI Status]\x1b[0m Model: ${this.aiAssistant.getCurrentModel()}\r\n`);
        this.terminal.write(`\x1b[36m[Session]\x1b[0m Commands: ${this.sessionCommands.length}\r\n`);
        this.writePrompt();
        return;
      } else if (question === 'share' || question === 'share link') {
        await this.copyShareLink();
        return;
      }
      
      await this.handleAICommand(question);
      return;
    }

    // Track command for session sharing (only if not replaying and not AI command)
    if (!this.isReplayingSession && !command.startsWith('@ai')) {
      this.sessionCommands.push(command);
    }

    // Execute command
    if (this.isConnected && this.backend && this.backend.getConnected()) {
      // Backend - commands are sent in real-time
      this.backend.sendInput(command + '\r\n');
    } else {
      // Fallback to direct execution
      await this.executeViaREST(command);
    }
  }

  private async executeViaREST(command: string): Promise<void> {
    try {
      // Execute command via backend
      if (!this.backend) {
        throw new Error('Backend not initialized');
      }
      const result = await this.backend.executeCommand(command, this.currentDirectory);
      
      // Display output with error detection
      if (result.exitCode !== 0) {
        // Error detected - show in red
        this.terminal.write(`\x1b[31m${result.output}\x1b[0m`);
        this.lastError = {
          command,
          output: result.output,
          timestamp: Date.now()
        };
        this.showErrorBanner(command, result.output);
      } else {
        this.terminal.write(result.output);
        this.hideErrorBanner();
      }
      
      // Update current directory if cd command
      if (command.startsWith('cd ')) {
        const dir = command.substring(3).trim();
        if (dir === '~' || dir === '') {
          if (this.backend) {
            const info = await this.backend.getSystemInfo();
            this.currentDirectory = info?.homeDir || (this.useBridge ? (info?.homeDir || '/') : '/home/user');
          }
        } else if (dir.startsWith('/')) {
          this.currentDirectory = dir;
        } else {
          this.currentDirectory = `${this.currentDirectory}/${dir}`;
        }
      }
      
      // If AI control is enabled and there's an error, auto-fix
      if (this.aiControlEnabled && result.exitCode !== 0 && !this.aiExecuting) {
        await this.autoQuickFix();
      }
      
      this.writePrompt();
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[ERROR]\x1b[0m ${error.message}\r\n`);
      this.lastError = {
        command,
        output: error.message,
        timestamp: Date.now()
      };
      this.showErrorBanner(command, error.message);
      this.writePrompt();
    }
  }

  private showErrorBanner(command: string, error: string): void {
    const banner = document.getElementById('error-banner');
    const errorText = document.getElementById('error-text');
    if (banner && errorText) {
      errorText.textContent = `Error in "${command}": ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`;
      banner.style.display = 'flex';
    }
  }

  private hideErrorBanner(): void {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  private async autoQuickFix(): Promise<void> {
    if (!this.lastError || this.aiExecuting) return;
    
    this.aiExecuting = true;
    this.updateAIStatus('thinking');
    this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Auto-fixing error...\r\n`);
    
    try {
      const fixCommand = await this.aiAssistant.quickFix(this.lastError.command, this.lastError.output);
      if (fixCommand) {
        this.terminal.write(`\x1b[33m[AI]\x1b[0m Executing fix: ${fixCommand}\r\n`);
        if (this.backend && this.backend.getConnected()) {
          this.backend.sendInput(fixCommand + '\r\n');
        } else {
          await this.executeViaREST(fixCommand);
        }
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
      this.updateAIStatus('error');
    } finally {
      this.aiExecuting = false;
      this.updateAIStatus(this.aiControlEnabled ? 'ready' : 'idle');
    }
  }

  public async manualQuickFix(): Promise<void> {
    if (!this.lastError) {
      this.terminal.write(`\x1b[33m[INFO]\x1b[0m No error to fix\r\n`);
      this.writePrompt();
      return;
    }

    this.aiExecuting = true;
    this.updateAIStatus('thinking');
    this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Diagnosing error...\r\n`);
    
    try {
      const fixCommand = await this.aiAssistant.quickFix(this.lastError.command, this.lastError.output);
      if (fixCommand) {
        this.terminal.write(`\x1b[33m[AI]\x1b[0m Executing fix: ${fixCommand}\r\n`);
        if (this.backend && this.backend.getConnected()) {
          this.backend.sendInput(fixCommand + '\r\n');
        } else {
          await this.executeViaREST(fixCommand);
        }
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
      this.updateAIStatus('error');
      this.writePrompt();
    } finally {
      this.aiExecuting = false;
      this.updateAIStatus(this.aiControlEnabled ? 'ready' : 'idle');
    }
  }

  private async handleAICommand(question: string): Promise<void> {
    this.aiExecuting = true;
    this.updateAIStatus('thinking');
    
    try {
      // Detect if this is a command request (action) vs a question
      const isCommandRequest = this.isCommandRequest(question);
      
      if (isCommandRequest) {
        // Silent execution mode - just do it, don't explain
        this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Executing...\r\n`);
        const response = await this.aiAssistant.askQuestion(
          `User wants to: ${question}. Provide ONLY the command(s) to execute, no explanations. Format in code blocks.`,
          this.currentDirectory,
          this.commandHistory
        );
        
        // Extract and execute commands silently
        const commands = this.extractCommands(response);
        if (commands.length > 0) {
          for (const command of commands) {
            // Execute silently without showing command
            if (this.backend && this.backend.getConnected()) {
              this.backend.sendInput(command + '\r\n');
            } else {
              await this.executeCommand(command);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } else {
          this.terminal.write(`\x1b[33m[AI]\x1b[0m No command found in response\r\n`);
        }
      } else {
        // Question mode - respond with explanation
        this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Thinking...\r\n`);
        const response = await this.aiAssistant.askQuestion(question, this.currentDirectory, this.commandHistory);
        
        // Parse and display markdown response
        this.displayMarkdownResponse(response);
        
        // Extract and execute commands from AI response (if AI control enabled)
        const commands = this.extractCommands(response);
        if (commands.length > 0 && this.aiControlEnabled) {
          for (const command of commands) {
            this.terminal.write(`\r\n\x1b[33m[AI Executing]\x1b[0m ${command}\r\n`);
            if (this.backend && this.backend.getConnected()) {
              this.backend.sendInput(command + '\r\n');
            } else {
              await this.executeCommand(command);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else if (commands.length > 0) {
          // Show commands but don't execute (user control)
          this.terminal.write(`\r\n\x1b[33m[AI Suggested]\x1b[0m Commands found:\r\n`);
          commands.forEach(cmd => {
            this.terminal.write(`  ${cmd}\r\n`);
          });
          this.terminal.write(`\x1b[33m[Tip]\x1b[0m Type "@ai enable" to let AI auto-execute commands\r\n`);
        }
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
      this.updateAIStatus('error');
    } finally {
      this.aiExecuting = false;
      this.updateAIStatus(this.aiControlEnabled ? 'ready' : 'idle');
      this.writePrompt();
    }
  }

  private isCommandRequest(text: string): boolean {
    // Detect if this is a command/action request vs a question
    const commandKeywords = [
      'enable', 'disable', 'start', 'stop', 'run', 'execute', 'install', 'setup',
      'configure', 'connect', 'enable adb', 'enable connection', 'turn on',
      'turn off', 'activate', 'deactivate', 'create', 'make', 'do', 'perform'
    ];
    
    const questionKeywords = [
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'describe',
      'tell me', 'help me understand', 'what is', 'how do', 'why does', '?'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Check for question keywords first
    if (questionKeywords.some(keyword => lowerText.includes(keyword))) {
      return false;
    }
    
    // Check for command keywords
    if (commandKeywords.some(keyword => lowerText.includes(keyword))) {
      return true;
    }
    
    // If it's short and doesn't contain question mark, likely a command
    if (text.length < 50 && !text.includes('?')) {
      return true;
    }
    
    // Default to question
    return false;
  }

  private displayMarkdownResponse(text: string): void {
    // Parse markdown and display with proper formatting
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeLanguage = '';
    
    for (const line of lines) {
      // Code blocks
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) {
          codeLanguage = line.trim().substring(3).trim();
          this.terminal.write(`\r\n\x1b[35m[Code: ${codeLanguage || 'text'}]\x1b[0m\r\n`);
        } else {
          this.terminal.write(`\r\n`);
        }
        continue;
      }
      
      if (inCodeBlock) {
        // Code block content
        this.terminal.write(`  \x1b[90m${line}\x1b[0m\r\n`);
      } else {
        // Regular text with markdown parsing
        let processed = line;
        
        // Bold text
        processed = processed.replace(/\*\*(.+?)\*\*/g, `\x1b[1m$1\x1b[0m`);
        
        // Inline code
        processed = processed.replace(/`([^`]+)`/g, `\x1b[35m$1\x1b[0m`);
        
        // Headers
        if (processed.startsWith('### ')) {
          processed = `\x1b[1m\x1b[36m${processed.substring(4)}\x1b[0m`;
        } else if (processed.startsWith('## ')) {
          processed = `\x1b[1m\x1b[36m${processed.substring(3)}\x1b[0m`;
        } else if (processed.startsWith('# ')) {
          processed = `\x1b[1m\x1b[36m${processed.substring(2)}\x1b[0m`;
        }
        
        // Lists
        if (processed.trim().startsWith('- ') || processed.trim().startsWith('* ')) {
          processed = `  \x1b[33m•\x1b[0m ${processed.trim().substring(2)}`;
        }
        
        this.terminal.write(`\x1b[36m[AI]\x1b[0m ${processed}\r\n`);
      }
    }
  }

  private extractCommands(text: string): string[] {
    const commands: string[] = [];
    
    // Extract from code blocks (prioritize bash/sh/zsh blocks)
    const codeBlockRegex = /```(?:bash|sh|zsh|cmd|powershell|shell)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const code = match[1].trim();
      const lines = code.split('\n');
      lines.forEach(line => {
        const cmd = line.trim();
        // Skip comments, prompts, and empty lines
        if (cmd && 
            !cmd.startsWith('#') && 
            !cmd.startsWith('$') && 
            !cmd.startsWith('>') &&
            !cmd.startsWith('//') &&
            cmd.length > 0 && 
            cmd.length < 500) {
          commands.push(cmd);
        }
      });
    }
    
    // Extract inline code that looks like commands (if no code blocks found)
    if (commands.length === 0) {
      const inlineCodeRegex = /`([^`]+)`/g;
      while ((match = inlineCodeRegex.exec(text)) !== null) {
        const cmd = match[1].trim();
        if (cmd && 
            cmd.length < 500 && 
            !cmd.includes('\n') && 
            /^[a-zA-Z0-9_\-./]/.test(cmd) &&
            !cmd.includes('http') &&
            !cmd.includes('www')) {
          commands.push(cmd);
        }
      }
    }
    
    // Also check for commands after "run:", "execute:", "command:" patterns
    if (commands.length === 0) {
      const commandPatterns = [
        /(?:run|execute|command|do):\s*([^\n]+)/gi,
        /`([^`]+)`/g,
        /(?:adb|sudo|npm|git|python|node|bash|sh)\s+[^\n]+/gi
      ];
      
      commandPatterns.forEach(pattern => {
        while ((match = pattern.exec(text)) !== null) {
          const cmd = match[1]?.trim() || match[0]?.trim();
          if (cmd && cmd.length > 0 && cmd.length < 500 && !cmd.startsWith('$')) {
            commands.push(cmd);
          }
        }
      });
    }
    
    return commands;
  }

  public writePrompt(): void {
    // Bridge backend handles prompts automatically
    // Only write prompt if not connected or using Web Worker
    if (!this.backend || !this.backend.getConnected() || !this.useBridge) {
      const shortPath = this.currentDirectory.replace(/^\/home\/[^\/]+/, '~').replace(/^~/, '~');
      const hostname = this.useBridge ? getHostname() : 'webvm';
      this.terminal.write(`\x1b[35muser@${hostname}\x1b[0m:\x1b[34m${shortPath}\x1b[0m$ `);
    }
  }

  private printWelcomeMessage(): void {
    this.terminal.write('\r\n');
    this.terminal.write(`\x1b[1m\x1b[35m╔════════════════════════════════════════╗\x1b[0m\r\n`);
    this.terminal.write(`\x1b[1m\x1b[35m║\x1b[0m  \x1b[1m\x1b[36mClay Terminal\x1b[0m - The best terminal experience  \x1b[1m\x1b[35m║\x1b[0m\r\n`);
    this.terminal.write(`\x1b[1m\x1b[35m╚════════════════════════════════════════╝\x1b[0m\r\n`);
    this.terminal.write('\r\n');
    this.terminal.write(`  \x1b[33m✨\x1b[0m Type \x1b[33m@ai <question>\x1b[0m to ask the AI assistant\r\n`);
    this.terminal.write(`  \x1b[33m✨\x1b[0m Type \x1b[33mhelp\x1b[0m for available commands\r\n`);
    this.terminal.write(`  \x1b[33m✨\x1b[0m Check status indicators at the top\r\n`);
    this.terminal.write('\r\n');
  }

  private hideLoading(): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hidden');
    }
  }
}

// AI Assistant
class SimpleAIAssistant {
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private readonly API_BASE_URL = 'https://api.llm7.io/v1';
  private readonly API_KEY = 'unused';
  private currentModel: string = 'codestral-2501';
  
  private readonly AVAILABLE_MODELS = [
    { id: 'codestral-2501', name: 'Codestral 2501', description: 'Best for Code' },
    { id: 'mistral-small-3.1-24b-instruct-2503', name: 'Mistral Small 3.1', description: 'Fast & Capable' },
    { id: 'deepseek-v3.1', name: 'DeepSeek V3.1', description: 'Advanced Reasoning' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast & Efficient' },
    { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano', description: 'Lightweight' },
    { id: 'gpt-5-chat', name: 'GPT-5 Chat', description: 'Conversational' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash', description: 'Google AI' },
    { id: 'codestral-2405', name: 'Codestral 2405', description: 'Code Specialist' },
  ];

  constructor() {
    this.conversationHistory.push({
      role: 'system',
      content: 'You are a helpful AI assistant specialized in coding, bash commands, and terminal operations. When providing commands, always format them in code blocks. Be concise but thorough.'
    });
  }

  public getAvailableModels() {
    return this.AVAILABLE_MODELS;
  }

  public getCurrentModel(): string {
    return this.currentModel;
  }

  public setModel(modelId: string): void {
    if (this.AVAILABLE_MODELS.find(m => m.id === modelId)) {
      this.currentModel = modelId;
    }
  }

  public async askQuestion(question: string, cwd?: string, history?: string[]): Promise<string> {
    // Build context-aware prompt
    let contextPrompt = question;
    if (cwd || history) {
      contextPrompt = `Current directory: ${cwd || '/home/user'}\n`;
      if (history && history.length > 0) {
        contextPrompt += `Recent commands: ${history.slice(-5).join(', ')}\n`;
      }
      contextPrompt += `\nUser question: ${question}`;
    }
    
    this.conversationHistory.push({ role: 'user', content: contextPrompt });

    try {
      const messages = [
        ...this.conversationHistory.filter(msg => msg.role === 'system'),
        ...this.conversationHistory.filter(msg => msg.role !== 'system').slice(-10),
      ];

      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
        },
        body: JSON.stringify({
          model: this.currentModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices[0]?.message?.content || 'No response generated';
      
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });
      
      if (this.conversationHistory.length > 30) {
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-20)
        ];
      }
      
      return assistantResponse;
    } catch (error: any) {
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }

  public async quickFix(command: string, error: string): Promise<string | null> {
    const prompt = `The command "${command}" failed with this error:\n${error}\n\nProvide ONLY the exact command to fix this issue. Format it in a code block like \`\`\`bash\nfix-command\n\`\`\`. Do not include explanations, just the fix command.`;
    
    try {
      const response = await this.askQuestion(prompt);
      const commands = this.extractCommand(response);
      return commands.length > 0 ? commands[0] : null;
    } catch (error: any) {
      throw error;
    }
  }

  private extractCommand(text: string): string[] {
    const commands: string[] = [];
    const codeBlockRegex = /```(?:bash|sh|zsh|cmd|powershell)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const code = match[1].trim();
      const lines = code.split('\n');
      lines.forEach(line => {
        const cmd = line.trim();
        if (cmd && !cmd.startsWith('#') && !cmd.startsWith('$') && cmd.length < 200) {
          commands.push(cmd);
        }
      });
    }
    return commands;
  }
}

// UI Builder - Creates all UI elements dynamically
class UIBuilder {
  private root: HTMLElement;
  private terminal: ClayWebTerminal | null = null;
  
  constructor() {
    this.root = document.getElementById('app-root') || document.body;
    this.buildUI();
    this.setupEventHandlers();
  }
  
  private buildUI(): void {
    // Clear root
    this.root.innerHTML = '';
    
    // App container
    const appContainer = document.createElement('div');
    appContainer.className = 'app-container';
    
    // Terminal container
    const terminalContainer = document.createElement('div');
    terminalContainer.className = 'terminal-container';
    
    // Terminal header
    const header = this.createHeader();
    terminalContainer.appendChild(header);
    
    // Terminal body
    const terminalBody = document.createElement('div');
    terminalBody.className = 'terminal-body';
    terminalBody.id = 'terminal';
    terminalContainer.appendChild(terminalBody);
    
    // Error banner
    const errorBanner = this.createErrorBanner();
    terminalContainer.appendChild(errorBanner);
    
    appContainer.appendChild(terminalContainer);
    
    // Model selector overlay
    const modelSelector = this.createModelSelector();
    appContainer.appendChild(modelSelector);
    
    // Loading overlay
    const loadingOverlay = this.createLoadingOverlay();
    appContainer.appendChild(loadingOverlay);
    
    this.root.appendChild(appContainer);
  }
  
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'terminal-header';
    
    // Controls
    const controls = document.createElement('div');
    controls.className = 'terminal-controls';
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'control close';
    closeBtn.id = 'window-close';
    
    const minimizeBtn = document.createElement('span');
    minimizeBtn.className = 'control minimize';
    minimizeBtn.id = 'window-minimize';
    
    const maximizeBtn = document.createElement('span');
    maximizeBtn.className = 'control maximize';
    maximizeBtn.id = 'window-maximize';
    
    controls.appendChild(closeBtn);
    controls.appendChild(minimizeBtn);
    controls.appendChild(maximizeBtn);
    
    // Title
    const title = document.createElement('div');
    title.className = 'terminal-title';
    title.textContent = 'Clay Terminal';
    
    // Header actions
    const actions = this.createHeaderActions();
    
    header.appendChild(controls);
    header.appendChild(title);
    header.appendChild(actions);
    
    return header;
  }
  
  private createHeaderActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'header-actions';
    
    // Status indicators
    const statusIndicators = document.createElement('div');
    statusIndicators.className = 'status-indicators';
    statusIndicators.id = 'status-indicators';
    
    const webvmStatus = this.createStatusItem('webvm-status', 'webvm-dot', 'webvm-text', 'WebVM');
    const websocketStatus = this.createStatusItem('websocket-status', 'websocket-dot', 'websocket-text', 'WebSocket');
    const bridgeStatus = this.createStatusItem('bridge-status', 'bridge-dot', 'bridge-text', 'Bridge');
    const aiStatus = this.createStatusItem('ai-status', 'ai-dot', 'ai-text', 'AI');
    
    websocketStatus.style.display = 'none';
    bridgeStatus.style.display = 'none';
    
    statusIndicators.appendChild(webvmStatus);
    statusIndicators.appendChild(websocketStatus);
    statusIndicators.appendChild(bridgeStatus);
    statusIndicators.appendChild(aiStatus);
    
    // Share button
    const shareBtn = this.createIconButton('share-btn', 'link', 'Share', 'Share Session');
    
    // Model button
    const modelBtn = this.createIconButton('model-btn', 'brain', 'Model', 'Select AI Model');
    
    // Install button
    const installBtn = this.createIconButton('install-btn', 'download', 'Install', 'Install App');
    installBtn.style.display = 'none';
    
    actions.appendChild(statusIndicators);
    actions.appendChild(shareBtn);
    actions.appendChild(modelBtn);
    actions.appendChild(installBtn);
    
    return actions;
  }
  
  private createStatusItem(itemId: string, dotId: string, textId: string, text: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'status-item';
    item.id = itemId;
    
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.id = dotId;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'status-text';
    textSpan.id = textId;
    textSpan.textContent = text;
    
    item.appendChild(dot);
    item.appendChild(textSpan);
    
    return item;
  }
  
  private createIconButton(id: string, icon: string, text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = id.replace('-btn', '-btn');
    btn.title = title;
    
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', icon);
    
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    
    btn.appendChild(iconEl);
    btn.appendChild(textSpan);
    
    return btn;
  }
  
  private createErrorBanner(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.id = 'error-banner';
    banner.style.display = 'none';
    
    const content = document.createElement('div');
    content.className = 'error-content';
    
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'alert-triangle');
    icon.className = 'error-icon';
    
    const text = document.createElement('span');
    text.className = 'error-text';
    text.id = 'error-text';
    
    const quickFixBtn = document.createElement('button');
    quickFixBtn.className = 'quick-fix-btn';
    quickFixBtn.id = 'quick-fix-btn';
    
    const fixIcon = document.createElement('i');
    fixIcon.setAttribute('data-lucide', 'wrench');
    
    const fixText = document.createElement('span');
    fixText.textContent = 'Quick Fix';
    
    quickFixBtn.appendChild(fixIcon);
    quickFixBtn.appendChild(fixText);
    
    content.appendChild(icon);
    content.appendChild(text);
    content.appendChild(quickFixBtn);
    
    banner.appendChild(content);
    
    return banner;
  }
  
  private createModelSelector(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'model-selector-overlay';
    overlay.id = 'model-selector';
    overlay.style.display = 'none';
    
    const content = document.createElement('div');
    content.className = 'model-selector-content';
    
    const header = document.createElement('div');
    header.className = 'model-selector-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Select AI Model';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.id = 'close-model-selector';
    closeBtn.textContent = '×';
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const modelList = document.createElement('div');
    modelList.className = 'model-list';
    modelList.id = 'model-list';
    
    content.appendChild(header);
    content.appendChild(modelList);
    
    overlay.appendChild(content);
    
    return overlay;
  }
  
  private createLoadingOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    const text = document.createElement('p');
    text.textContent = 'Initializing Terminal...';
    
    overlay.appendChild(spinner);
    overlay.appendChild(text);
    
    return overlay;
  }
  
  private setupEventHandlers(): void {
    // Prevent form submission and page scrolling
    document.addEventListener('keydown', (e) => {
      // Prevent default behavior for Enter key to stop page scrolling
      if (e.key === 'Enter' && e.target === document.body) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    
    // Prevent any form submission
    document.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);
  }
  
  public initializeTerminal(): void {
    this.terminal = new ClayWebTerminal();
  }
  
  public getTerminal(): ClayWebTerminal | null {
    return this.terminal;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Build UI dynamically
  const uiBuilder = new UIBuilder();
  
  // Initialize terminal after UI is built
  setTimeout(() => {
    uiBuilder.initializeTerminal();
    
    // Model selector UI
    const modelBtn = document.getElementById('model-btn');
  const modelSelector = document.getElementById('model-selector');
  const closeModelSelector = document.getElementById('close-model-selector');
  const modelList = document.getElementById('model-list');
  const quickFixBtn = document.getElementById('quick-fix-btn');
  const shareBtn = document.getElementById('share-btn');
  
  if (modelBtn && modelSelector && closeModelSelector && modelList) {
    modelBtn.addEventListener('click', () => {
      modelSelector.style.display = 'flex';
      renderModelList();
    });
    
    closeModelSelector.addEventListener('click', () => {
      modelSelector.style.display = 'none';
    });
    
    modelSelector.addEventListener('click', (e) => {
      if (e.target === modelSelector) {
        modelSelector.style.display = 'none';
      }
    });
  }
  
  function renderModelList() {
    if (!modelList) return;
    modelList.innerHTML = '';
    
    const terminal = (window as any).clayTerminal;
    if (!terminal || !terminal.aiAssistant) return;
    
    const models = terminal.aiAssistant.getAvailableModels();
    const currentModel = terminal.aiAssistant.getCurrentModel();
    
    // Update model button text
    const modelBtn = document.getElementById('model-btn');
    if (modelBtn) {
      const currentModelData = models.find((m: any) => m.id === currentModel);
      if (currentModelData) {
        const modelBtnIcon = modelBtn.querySelector('[data-lucide]');
        const modelBtnText = modelBtn.querySelector('span');
        if (modelBtnText) {
          modelBtnText.textContent = currentModelData.name;
        }
        if (typeof (window as any).lucide !== 'undefined') {
          (window as any).lucide.createIcons();
        }
        modelBtn.classList.add('active');
      }
    }
    
    models.forEach((model: any) => {
      const item = document.createElement('div');
      item.className = `model-item ${model.id === currentModel ? 'active' : ''}`;
      item.innerHTML = `
        <div class="model-info">
          <div class="model-name">${model.name}</div>
          <div class="model-desc">${model.description}</div>
        </div>
        ${model.id === currentModel ? '<span class="checkmark">✓</span>' : ''}
      `;
      item.addEventListener('click', () => {
        terminal.aiAssistant.setModel(model.id);
        modelSelector!.style.display = 'none';
        // Update button
        if (modelBtn) {
          const updatedModel = models.find((m: any) => m.id === model.id);
          if (updatedModel) {
            const modelBtnText = modelBtn.querySelector('span');
            if (modelBtnText) {
              modelBtnText.textContent = updatedModel.name;
            }
            if (typeof (window as any).lucide !== 'undefined') {
              (window as any).lucide.createIcons();
            }
          }
        }
        // Show confirmation in terminal
        terminal.terminal.write(`\r\n\x1b[32m[Model]\x1b[0m Switched to ${model.name}\r\n`);
        if (!terminal.useBridge) {
          terminal.writePrompt();
        }
      });
      modelList.appendChild(item);
    });
  }
  
  // Quick fix button
  if (quickFixBtn) {
    quickFixBtn.addEventListener('click', () => {
      (window as any).clayTerminal.manualQuickFix();
    });
  }
  
  // Share button
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      await (window as any).clayTerminal.copyShareLink();
    });
    
    // Show badge with command count if there are commands
    setInterval(() => {
      const terminal = (window as any).clayTerminal;
      if (terminal && terminal.sessionCommands) {
        const count = terminal.sessionCommands.length;
        if (count > 0) {
          shareBtn.setAttribute('data-count', count.toString());
          shareBtn.classList.add('has-commands');
        } else {
          shareBtn.removeAttribute('data-count');
          shareBtn.classList.remove('has-commands');
        }
      }
    }, 1000);
  }
  
    // Initialize Lucide icons after DOM is ready
    if (typeof (window as any).lucide !== 'undefined') {
      (window as any).lucide.createIcons();
    }
    
    // Refresh icons periodically
    setInterval(() => {
      if (typeof (window as any).lucide !== 'undefined') {
        (window as any).lucide.createIcons();
      }
    }, 2000);
  }, 100);
  
  // PWA install handler
  let deferredPrompt: any = null;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
      installBtn.style.display = 'block';
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          deferredPrompt = null;
        }
      });
    }
  });
});

