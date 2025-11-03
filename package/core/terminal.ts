/**
 * Clay Terminal Core - Main terminal class
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { CanvasAddon } from 'xterm-addon-canvas';
import type { ClayTerminalConfig, TerminalBackend, OutputCallback, ErrorCallback, StatusCallback } from '../types';
import { BridgeBackend } from '../backend/bridge-backend';
import { WebWorkerBackend } from '../backend/web-worker-backend';

export class ClayTerminal {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private backend: TerminalBackend | null = null;
  private config: ClayTerminalConfig;
  private isConnected: boolean = false;
  private commandHistory: string[] = [];
  private sessionCommands: string[] = [];
  private outputCallbacks: OutputCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];

  constructor(config: ClayTerminalConfig) {
    this.config = config;
    
    // Initialize xterm.js terminal
    this.terminal = new Terminal({
      theme: config.theme || this.getDefaultTheme(),
      fontSize: config.fontSize || 13,
      fontFamily: config.fontFamily || '"SF Mono", "Menlo", "Monaco", "DejaVu Sans Mono", "Lucida Console", monospace',
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
  }

  /**
   * Initialize the terminal
   */
  async initialize(): Promise<void> {
    // Mount terminal to container
    if (!this.config.container) {
      throw new Error('Container element is required');
    }
    
    this.terminal.open(this.config.container);
    
    // Fit terminal to container
    setTimeout(() => {
      this.fitAddon.fit();
    }, 100);

    // Handle window resize
    let resizeTimeout: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.fitAddon.fit();
        if (this.backend && this.backend.getConnected()) {
          const dimensions = this.fitAddon.proposeDimensions();
          if (dimensions) {
            this.backend.resize(dimensions.cols, dimensions.rows);
          }
        }
      }, 150);
    });

    // Handle keyboard input
    this.terminal.onData((data: string) => {
      if (this.isConnected && this.backend && this.backend.getConnected()) {
        this.backend.sendInput(data);
      }
    });

    // Initialize backend
    await this.setupBackend();

    // Show welcome message if enabled
    const showWelcome = (this.config as any).showWelcome !== false;
    if (showWelcome) {
      this.printWelcomeMessage();
    }
  }

  /**
   * Setup backend connection
   */
  private async setupBackend(): Promise<void> {
    // Try bridge first if URL provided
    if (this.config.bridgeUrl || this.config.autoConnectBridge) {
      const bridgeUrl = this.config.bridgeUrl || 'ws://127.0.0.1:8765/ws';
      this.backend = new BridgeBackend(bridgeUrl);
      
      try {
        const isHealthy = await (this.backend as any).healthCheck();
        if (isHealthy) {
          await this.connectToBackend();
          return;
        }
      } catch (error) {
        console.warn('Bridge not available, using Web Worker fallback');
      }
    }

    // Fallback to Web Worker
    this.backend = new WebWorkerBackend();
    await this.connectToBackend();
  }

  /**
   * Connect to backend
   */
  private async connectToBackend(): Promise<void> {
    if (!this.backend) return;

    // Set up output handler
    this.backend.onOutput((data: string) => {
      this.terminal.write(data);
      this.outputCallbacks.forEach(cb => cb(data));
    });

    this.backend.onExit((code: number, signal: number) => {
      this.terminal.write(`\r\n\x1b[33m[Process exited]\x1b[0m Code: ${code}\r\n`);
    });

    this.backend.onError((error: string) => {
      this.terminal.write(`\r\n\x1b[31m[Connection Error]\x1b[0m ${error}\r\n`);
      this.errorCallbacks.forEach(cb => cb(error));
      this.updateStatus({ backend: 'error', ai: 'idle' });
    });

    try {
      await this.backend.connect();
      this.isConnected = true;
      this.updateStatus({ backend: 'connected', ai: 'idle' });
    } catch (error: any) {
      this.updateStatus({ backend: 'error', ai: 'idle' });
      throw error;
    }
  }

  /**
   * Write data to terminal
   */
  write(data: string): void {
    this.terminal.write(data);
  }

  /**
   * Execute a command
   */
  async executeCommand(command: string): Promise<void> {
    if (!this.backend || !this.backend.getConnected()) {
      throw new Error('Backend not connected');
    }

    this.sessionCommands.push(command);
    this.backend.sendInput(command + '\r\n');
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.commandHistory];
  }

  /**
   * Get session commands (for sharing)
   */
  getSessionCommands(): string[] {
    return [...this.sessionCommands];
  }

  /**
   * Clear terminal
   */
  clear(): void {
    this.terminal.clear();
  }

  /**
   * Resize terminal
   */
  resize(): void {
    this.fitAddon.fit();
    if (this.backend && this.backend.getConnected()) {
      const dimensions = this.fitAddon.proposeDimensions();
      if (dimensions) {
        this.backend.resize(dimensions.cols, dimensions.rows);
      }
    }
  }

  /**
   * Register output callback
   */
  onOutput(callback: OutputCallback): void {
    this.outputCallbacks.push(callback);
  }

  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register status change callback
   */
  onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(status: Parameters<StatusCallback>[0]): void {
    this.statusCallbacks.forEach(cb => cb(status));
  }

  /**
   * Disconnect and cleanup
   */
  dispose(): void {
    if (this.backend) {
      this.backend.disconnect();
    }
    this.terminal.dispose();
  }

  /**
   * Get default Catppuccin Mocha theme
   */
  private getDefaultTheme() {
    return {
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
    };
  }

  /**
   * Print welcome message
   */
  private printWelcomeMessage(): void {
    this.terminal.write('\r\n');
    this.terminal.write(`\x1b[1m\x1b[35m╔════════════════════════════════════════╗\x1b[0m\r\n`);
    this.terminal.write(`\x1b[1m\x1b[35m║\x1b[0m  \x1b[1m\x1b[36mClay Terminal\x1b[0m - The best terminal experience  \x1b[1m\x1b[35m║\x1b[0m\r\n`);
    this.terminal.write(`\x1b[1m\x1b[35m╚════════════════════════════════════════╝\x1b[0m\r\n`);
    this.terminal.write('\r\n');
    this.terminal.write(`  \x1b[33m✨\x1b[0m Perfect for ChromeOS users\r\n`);
    this.terminal.write(`  \x1b[33m✨\x1b[0m Type \x1b[33mhelp\x1b[0m for available commands\r\n`);
    this.terminal.write('\r\n');
  }
}

