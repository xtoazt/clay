/**
 * Type definitions for Clay Terminal
 */

export interface ClayTerminalConfig {
  /** DOM element to mount the terminal */
  container: HTMLElement;
  
  /** WebSocket URL for bridge backend (optional, for real system access) */
  bridgeUrl?: string;
  
  /** Enable AI assistant features */
  enableAI?: boolean;
  
  /** AI API configuration */
  aiConfig?: AIAssistantConfig;
  
  /** Terminal theme (Catppuccin Mocha colors) */
  theme?: TerminalTheme;
  
  /** Font size in pixels */
  fontSize?: number;
  
  /** Font family */
  fontFamily?: string;
  
  /** Callback for terminal output */
  onOutput?: OutputCallback;
  
  /** Callback for errors */
  onError?: ErrorCallback;
  
  /** Callback for status changes */
  onStatusChange?: StatusCallback;
  
  /** Auto-start bridge connection */
  autoConnectBridge?: boolean;
  
  /** Custom CSS classes */
  className?: string;
  
  /** Show welcome message on initialization */
  showWelcome?: boolean;
}

export interface ClayTerminalOptions {
  /** Enable session sharing */
  enableSharing?: boolean;
  
  /** Enable command history */
  enableHistory?: boolean;
  
  /** Maximum history size */
  maxHistory?: number;
  
  /** Show welcome message */
  showWelcome?: boolean;
}

export interface TerminalTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

export interface AIAssistantConfig {
  /** AI API base URL */
  apiBaseUrl?: string;
  
  /** AI API key */
  apiKey?: string;
  
  /** Default AI model */
  defaultModel?: string;
  
  /** Available AI models */
  models?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface TerminalBackend {
  connect(): Promise<void>;
  disconnect(): void;
  sendInput(data: string): void;
  executeCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }>;
  getSystemInfo(): Promise<any>;
  resize(cols: number, rows: number): void;
  getConnected(): boolean;
  onOutput(callback: OutputCallback): void;
  onExit(callback: (code: number, signal: number) => void): void;
  onError(callback: ErrorCallback): void;
}

export type OutputCallback = (data: string) => void;
export type ErrorCallback = (error: string) => void;
export type StatusCallback = (status: {
  backend: 'connected' | 'disconnected' | 'connecting' | 'error';
  ai: 'ready' | 'idle' | 'thinking' | 'error';
}) => void;

