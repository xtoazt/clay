import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { CanvasAddon } from 'xterm-addon-canvas';
import { BridgeBackend } from './bridge-backend';
import { WebWorkerBackendWrapper } from './backend-worker-wrapper';
import { SessionEncoder } from './session-encoder';
import { initializeHTML } from './html-generator';
import './app.css';

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
  private historySearchMode: boolean = false;
  private historySearchQuery: string = '';
  private autocompleteSuggestions: string[] = [];
  private autocompleteIndex: number = -1;
  private webvmStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  private websocketStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  private bridgeStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  private searchProvider: 'searxng' | 'langsearch' = 'langsearch';
  private cpuUsage: number = 0;
  private searxngRunning: boolean = false;
  private readonly LANGSEARCH_API_KEY = 'sk-d8b452643825433199b288a074ce3e28';
  private readonly LANGSEARCH_API_URL = 'https://api.langsearch.com/v1/web-search';
  private readonly CPU_THRESHOLD = 70; // Switch to LangSearch if CPU > 70%
  private lastSearchResults: any[] = []; // Store last search results for AI/terminal access
  private lastSearchQuery: string = ''; // Store last search query
  private searchStatus: 'idle' | 'searching' | 'ready' = 'idle';

  constructor() {
    // Redesigned terminal with modern dark theme
    this.terminal = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e7',
        cursor: '#3b82f6',
        cursorAccent: '#0a0a0a',
        black: '#1f2937',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#4b5563',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#f9fafb'
      },
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Menlo", "Monaco", "DejaVu Sans Mono", monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowTransparency: false,
      lineHeight: 1.5,
      letterSpacing: 0.5,
      scrollback: 10000,
      tabStopWidth: 4
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());
    this.terminal.loadAddon(new CanvasAddon());

    // AI Assistant - ALWAYS initialize, regardless of backend
    try {
      this.aiAssistant = new SimpleAIAssistant();
    } catch (error) {
      console.error('Failed to initialize AI assistant:', error);
      // Create a fallback AI assistant that always works
      this.aiAssistant = new SimpleAIAssistant();
    }
    
    this.isChromeOS = isChromeOS();
    
    // Try to connect to bridge first (real system access), fallback to Web Worker
    this.initializeBackend();

    // Expose to window for UI access
    (window as any).clayTerminal = this;

    // Wait for DOM to be ready before initializing
    setTimeout(() => {
      this.initializeTerminal();
      this.setupBackend();
      this.initializeStatusBar();
      this.checkForShareLink();
      
      // Initialize Lucide icons
      if (typeof (window as any).lucide !== 'undefined') {
        (window as any).lucide.createIcons();
      }
      
      // Hide loading overlay after a delay
      setTimeout(() => {
        this.hideLoading();
      }, 1000);
    }, 100);
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
    // Update status indicators
    this.updateWebVMStatus('connecting');
    this.updateWebSocketStatus('disconnected');
    this.updateBridgeStatus('disconnected');
    this.updateAIStatus('idle');
    this.updateOSInfo();
    this.updateCPUUsage();
    this.updateSearchStatus('idle');
    
    // Periodically check backend status and CPU
    setInterval(() => {
      this.checkBackendComponents();
      this.updateCPUUsage();
      this.updateSearchStatus(this.searchStatus); // Refresh search status display
    }, 2000);
    
    // Setup model selector
    const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
    if (modelSelect && this.aiAssistant) {
      const currentModel = this.aiAssistant.getCurrentModel();
      modelSelect.value = currentModel;
      modelSelect.addEventListener('change', () => {
        if (this.aiAssistant) {
          this.aiAssistant.setModel(modelSelect.value);
          this.terminal.write(`\r\n\x1b[32m[AI]\x1b[0m Model changed to: ${modelSelect.value}\r\n`);
          this.writePrompt();
        }
      });
    }
  }
  
  private updateOSInfo(): void {
    const osText = document.getElementById('os-text');
    if (!osText) return;
    
    if (this.useBridge && this.backend) {
      this.backend.getSystemInfo().then(info => {
        if (info) {
          const platform = info.platform || 'Unknown';
          const arch = info.arch || '';
          osText.textContent = `OS: ${platform}${arch ? `/${arch}` : ''}`;
        }
      }).catch(() => {
        osText.textContent = 'OS: Unknown';
      });
    } else {
      // Browser detection
      const userAgent = navigator.userAgent;
      let os = 'Unknown';
      if (userAgent.includes('Win')) os = 'Windows';
      else if (userAgent.includes('Mac')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('CrOS')) os = 'ChromeOS';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS')) os = 'iOS';
      
      osText.textContent = `OS: ${os}`;
    }
  }
  
  private updateCPUUsage(): void {
    const cpuText = document.getElementById('cpu-text');
    if (!cpuText) return;
    
    if (this.useBridge && this.backend) {
      // Try to get CPU usage from bridge
      this.backend.executeCommand('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'').then(result => {
        if (result.exitCode === 0 && result.output.trim()) {
          const cpu = parseFloat(result.output.trim());
          if (!isNaN(cpu)) {
            this.cpuUsage = cpu;
            cpuText.textContent = `CPU: ${cpu.toFixed(1)}%`;
            
            // Switch search provider based on CPU usage
            if (cpu > this.CPU_THRESHOLD && this.searchProvider === 'searxng') {
              this.searchProvider = 'langsearch';
              if (this.searxngRunning) {
                this.stopSearXNG();
              }
            } else if (cpu <= this.CPU_THRESHOLD && this.searchProvider === 'langsearch' && !this.searxngRunning) {
              // Consider starting SearXNG if CPU is low
              // Don't auto-start, let user decide
            }
          }
        }
      }).catch(() => {
        // Fallback: use performance API
        if ('performance' in window && 'memory' in performance) {
          const memInfo = (performance as any).memory;
          if (memInfo) {
            const used = memInfo.usedJSHeapSize / 1048576;
            cpuText.textContent = `Mem: ${used.toFixed(0)}MB`;
          }
        }
      });
    } else {
      // Browser: show memory usage
      if ('performance' in window && 'memory' in performance) {
        const memInfo = (performance as any).memory;
        if (memInfo) {
          const used = memInfo.usedJSHeapSize / 1048576;
          cpuText.textContent = `Mem: ${used.toFixed(0)}MB`;
        }
      }
    }
  }
  
  private async startSearXNG(): Promise<boolean> {
    if (this.searxngRunning) {
      return true;
    }
    
    if (!this.useBridge || !this.backend) {
      return false;
    }
    
    try {
      this.terminal.write(`\r\n\x1b[36m[Search]\x1b[0m Starting SearXNG on WebVM...\r\n`);
      
      // Check if SearXNG is installed
      const checkResult = await this.backend.executeCommand('which searxng || echo "not found"');
      if (checkResult.output.includes('not found')) {
        // Install SearXNG
        this.terminal.write(`\x1b[33m[Search]\x1b[0m Installing SearXNG...\r\n`);
        const installResult = await this.backend.executeCommand('pip install searxng || docker pull searxng/searxng || echo "install failed"');
        if (installResult.output.includes('install failed')) {
          this.terminal.write(`\x1b[31m[Search]\x1b[0m Failed to install SearXNG. Using LangSearch instead.\r\n`);
          this.searchProvider = 'langsearch';
          return false;
        }
      }
      
      // Start SearXNG (simplified - would need proper setup)
      this.terminal.write(`\x1b[33m[Search]\x1b[0m SearXNG installation/startup requires Docker or Python environment.\r\n`);
      this.terminal.write(`\x1b[33m[Search]\x1b[0m Using LangSearch API for now.\r\n`);
      this.searchProvider = 'langsearch';
      return false;
    } catch (error) {
      this.terminal.write(`\x1b[31m[Search]\x1b[0m Error starting SearXNG: ${error}\r\n`);
      this.searchProvider = 'langsearch';
      return false;
    }
  }
  
  private async stopSearXNG(): Promise<void> {
    if (!this.searxngRunning) return;
    
    try {
      if (this.backend) {
        await this.backend.executeCommand('pkill -f searxng || docker stop searxng || true');
      }
      this.searxngRunning = false;
      this.terminal.write(`\r\n\x1b[33m[Search]\x1b[0m SearXNG stopped. Switching to LangSearch.\r\n`);
    } catch (error) {
      console.error('Error stopping SearXNG:', error);
    }
  }
  
  private async performWebSearch(query: string, silent: boolean = false): Promise<any[]> {
    if (!silent) {
      this.terminal.write(`\r\n\x1b[36m[Search]\x1b[0m Searching for: "${query}"\r\n`);
    }
    
    this.updateSearchStatus('searching');
    this.lastSearchQuery = query;
    this.lastSearchResults = [];
    
    // Check CPU and decide provider
    if (this.cpuUsage > this.CPU_THRESHOLD && this.searchProvider === 'searxng') {
      if (!silent) {
        this.terminal.write(`\x1b[33m[Search]\x1b[0m CPU usage high (${this.cpuUsage.toFixed(1)}%). Using LangSearch API.\r\n`);
      }
      this.searchProvider = 'langsearch';
      if (this.searxngRunning) {
        await this.stopSearXNG();
      }
    }
    
    if (this.searchProvider === 'searxng' && !this.searxngRunning) {
      const started = await this.startSearXNG();
      if (!started) {
        this.searchProvider = 'langsearch';
      }
    }
    
    let results: any[] = [];
    if (this.searchProvider === 'langsearch') {
      results = await this.searchWithLangSearch(query, silent);
    } else {
      results = await this.searchWithSearXNG(query, silent);
    }
    
    this.lastSearchResults = results;
    this.updateSearchStatus('ready');
    return results;
  }
  
  private updateSearchStatus(status: 'idle' | 'searching' | 'ready'): void {
    this.searchStatus = status;
    const searchDot = document.getElementById('search-dot');
    const searchText = document.getElementById('search-text');
    
    if (!searchDot || !searchText) return;
    
    const provider = this.searchProvider === 'searxng' ? 'SearXNG' : 'LangSearch';
    
    switch (status) {
      case 'searching':
        searchDot.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse-slow';
        searchText.textContent = `Search: ${provider}...`;
        break;
      case 'ready':
        searchDot.className = 'w-2 h-2 rounded-full bg-green-500 status-dot connected';
        searchText.textContent = `Search: ${provider}`;
        break;
      case 'idle':
      default:
        searchDot.className = 'w-2 h-2 rounded-full bg-gray-500';
        searchText.textContent = `Search: ${provider}`;
        break;
    }
  }
  
  private async searchWithLangSearch(query: string, silent: boolean = false): Promise<any[]> {
    try {
      if (!silent) {
        this.terminal.write(`\x1b[33m[Search]\x1b[0m Using LangSearch API...\r\n`);
      }
      
      const response = await fetch(this.LANGSEARCH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.LANGSEARCH_API_KEY}`
        },
        body: JSON.stringify({
          query: query,
          freshness: 'noLimit',
          summary: true,
          count: 10
        })
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code === 200 && data.data && data.data.webPages && data.data.webPages.value) {
        const results = data.data.webPages.value;
        
        if (!silent) {
          this.terminal.write(`\r\n\x1b[32m[Search Results]\x1b[0m Found ${results.length} result(s)\r\n`);
          this.terminal.write(`\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m\r\n\r\n`);
          
          results.forEach((result: any, index: number) => {
            this.terminal.write(`\x1b[33m[${index + 1}]\x1b[0m \x1b[1m${result.name || 'No title'}\x1b[0m\r\n`);
            this.terminal.write(`\x1b[36mURL:\x1b[0m ${result.url || result.displayUrl || 'N/A'}\r\n`);
            
            if (result.snippet) {
              this.terminal.write(`\x1b[37m${result.snippet.substring(0, 200)}${result.snippet.length > 200 ? '...' : ''}\x1b[0m\r\n`);
            }
            
            if (result.summary && result.summary.length > result.snippet?.length) {
              this.terminal.write(`\x1b[90m${result.summary.substring(0, 300)}${result.summary.length > 300 ? '...' : ''}\x1b[0m\r\n`);
            }
            
            this.terminal.write('\r\n');
          });
          
          this.terminal.write(`\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m\r\n`);
        }
        
        return results;
      } else {
        if (!silent) {
          this.terminal.write(`\x1b[31m[Search Error]\x1b[0m No results found or invalid response.\r\n`);
        }
        return [];
      }
    } catch (error: any) {
      if (!silent) {
        this.terminal.write(`\r\n\x1b[31m[Search Error]\x1b[0m ${error.message || 'Failed to perform search'}\r\n`);
      }
      return [];
    }
  }
  
  private async searchWithSearXNG(query: string, silent: boolean = false): Promise<any[]> {
    try {
      // SearXNG would be running on localhost:port
      // This is a placeholder - would need actual SearXNG setup
      const searxngUrl = 'http://127.0.0.1:8888';
      const response = await fetch(`${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`);
      
      if (!response.ok) {
        throw new Error('SearXNG not responding');
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        if (!silent) {
          this.terminal.write(`\r\n\x1b[32m[Search Results]\x1b[0m Found ${data.results.length} result(s) via SearXNG\r\n`);
          data.results.forEach((result: any, index: number) => {
            this.terminal.write(`\r\n\x1b[33m[${index + 1}]\x1b[0m \x1b[1m${result.title}\x1b[0m\r\n`);
            this.terminal.write(`\x1b[36mURL:\x1b[0m ${result.url}\r\n`);
            this.terminal.write(`\x1b[37m${result.content || ''}\x1b[0m\r\n`);
          });
        }
        
        return data.results;
      }
      return [];
    } catch (error: any) {
      if (!silent) {
        this.terminal.write(`\r\n\x1b[33m[Search]\x1b[0m SearXNG unavailable. Falling back to LangSearch...\r\n`);
      }
      this.searchProvider = 'langsearch';
      return await this.searchWithLangSearch(query, silent);
    }
  }
  
  // Public method for AI to access search functionality
  public async searchForAI(query: string): Promise<string> {
    const results = await this.performWebSearch(query, true);
    
    if (results.length === 0) {
      return 'No search results found.';
    }
    
    // Format results as text for AI
    let formattedResults = `Search results for "${query}":\n\n`;
    results.slice(0, 5).forEach((result: any, index: number) => {
      formattedResults += `${index + 1}. ${result.name || result.title || 'No title'}\n`;
      formattedResults += `   URL: ${result.url || result.displayUrl || 'N/A'}\n`;
      formattedResults += `   Summary: ${result.summary || result.snippet || result.content || 'No summary'}\n\n`;
    });
    
    return formattedResults;
  }
  
  // Get last search results for AI context
  public getLastSearchResults(): any[] {
    return this.lastSearchResults;
  }
  
  public getLastSearchQuery(): string {
    return this.lastSearchQuery;
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
    
    if (dot) {
      const colorMap: Record<string, string> = {
        'connected': 'bg-green-500',
        'disconnected': 'bg-gray-500',
        'connecting': 'bg-yellow-500',
        'error': 'bg-red-500'
      };
      dot.className = `w-2 h-2 rounded-full ${colorMap[status] || 'bg-gray-500'}`;
    }
    if (text) {
      text.textContent = status === 'connecting' ? 'WebVM...' : 'WebVM';
    }
  }
  
  private updateWebSocketStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
    this.websocketStatus = status;
    const dot = document.getElementById('websocket-dot');
    const text = document.getElementById('websocket-text');
    
    if (dot) {
      const colorMap: Record<string, string> = {
        'connected': 'bg-green-500',
        'disconnected': 'bg-gray-500',
        'connecting': 'bg-yellow-500',
        'error': 'bg-red-500'
      };
      dot.className = `w-2 h-2 rounded-full ${colorMap[status] || 'bg-gray-500'}`;
    }
    if (text) {
      text.textContent = status === 'connecting' ? 'WebSocket...' : 'WebSocket';
    }
  }
  
  private updateBridgeStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
    this.bridgeStatus = status;
    const dot = document.getElementById('bridge-dot');
    const text = document.getElementById('bridge-text');
    
    if (dot) {
      const colorMap: Record<string, string> = {
        'connected': 'bg-green-500',
        'disconnected': 'bg-gray-500',
        'connecting': 'bg-yellow-500',
        'error': 'bg-red-500'
      };
      dot.className = `w-2 h-2 rounded-full ${colorMap[status] || 'bg-gray-500'}`;
    }
    if (text) {
      text.textContent = status === 'connecting' ? 'Bridge...' : 'Bridge';
    }
  }

  private updateAIStatus(status: 'ready' | 'idle' | 'thinking' | 'error'): void {
    const dot = document.getElementById('ai-dot');
    const text = document.getElementById('ai-text');
    
    if (dot) {
      const statusMap: Record<string, string> = {
        'idle': 'bg-gray-500',
        'thinking': 'bg-yellow-500',
        'ready': 'bg-green-500',
        'error': 'bg-red-500'
      };
      dot.className = `w-2 h-2 rounded-full ${statusMap[status] || 'bg-gray-500'}`;
    }
    if (text) {
      text.textContent = `AI: ${status}`;
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
    
    // Enhanced keyboard shortcuts
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Tab completion
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        this.handleTabCompletion();
        return false;
      }
      
      // Ctrl+R for history search
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        this.startHistorySearch();
        return false;
      }
      
      // Escape to cancel search
      if (event.key === 'Escape' && this.historySearchMode) {
        event.preventDefault();
        this.cancelHistorySearch();
        return false;
      }
      
      return true;
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

    // Handle copy (Ctrl+C) - copy selected text if any, otherwise send interrupt
    this.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        const selection = this.terminal.getSelection();
        if (selection && selection.length > 0) {
          // Copy selected text
          navigator.clipboard.writeText(selection).then(() => {
            this.terminal.write(`\r\n\x1b[32m[Copied to clipboard]\x1b[0m\r\n`);
            this.writePrompt();
          }).catch(() => {});
          return false;
        }
        // If no selection, let it through as interrupt (Ctrl+C)
      }
      // Handle paste (Ctrl+V)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (this.isConnected && this.backend && this.backend.getConnected()) {
            this.backend.sendInput(text);
          } else {
            this.currentLine += text;
            this.terminal.write(text);
          }
        }).catch(() => {});
        return false;
      }
      return true;
    });

    // Right-click context menu for copy
    terminalElement.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const selection = this.terminal.getSelection();
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection).then(() => {
          this.terminal.write(`\r\n\x1b[32m[Copied to clipboard]\x1b[0m\r\n`);
          this.writePrompt();
        }).catch(() => {});
      }
    });

    // Double-click to select word and copy
    terminalElement.addEventListener('dblclick', () => {
      const selection = this.terminal.getSelection();
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection).then(() => {
          this.terminal.write(`\r\n\x1b[32m[Copied to clipboard]\x1b[0m\r\n`);
          this.writePrompt();
        }).catch(() => {});
      }
    });

    this.printWelcomeMessage();
  }

  private async checkLinuxFilesAccess(): Promise<string | null> {
    // Check for ChromeOS Linux Files access
    const possiblePaths = [
      '/mnt/chromeos/MyFiles/LinuxFiles',
      '/home/chronos/user/MyFiles/LinuxFiles',
      '~/LinuxFiles',
      '~/MyFiles/LinuxFiles'
    ];
    
    if (this.useBridge && this.backend) {
      try {
        // Try to check if Linux Files path exists
        const result = await this.backend.executeCommand('test -d /mnt/chromeos/MyFiles/LinuxFiles && echo "EXISTS" || echo "NOT_FOUND"');
        if (result.output.includes('EXISTS')) {
          return '/mnt/chromeos/MyFiles/LinuxFiles';
        }
        
        // Try alternative path
        const result2 = await this.backend.executeCommand('test -d ~/LinuxFiles && echo "EXISTS" || echo "NOT_FOUND"');
        if (result2.output.includes('EXISTS')) {
          const homeResult = await this.backend.executeCommand('echo $HOME');
          return `${homeResult.output.trim()}/LinuxFiles`;
        }
      } catch (error) {
        console.log('[INFO] Could not check Linux Files access:', error);
      }
    }
    
    return null;
  }

  private async saveToLinuxFiles(content: string, filename: string): Promise<boolean> {
    try {
      const linuxFilesPath = await this.checkLinuxFilesAccess();
      if (!linuxFilesPath) {
        return false;
      }
      
      // Use backend to save file
      const fullPath = `${linuxFilesPath}/${filename}`;
      const escapedContent = content.replace(/'/g, "'\\''");
      const command = `cat > '${fullPath}' << 'EOF'\n${content}\nEOF`;
      
      if (this.backend && this.backend.getConnected()) {
        const result = await this.backend.executeCommand(command);
        return result.exitCode === 0;
      }
      
      return false;
    } catch (error) {
      console.error('Error saving to Linux Files:', error);
      return false;
    }
  }

  private async initializeBackend(): Promise<void> {
    // Always try to connect to bridge first (works on any platform, not just ChromeOS)
    const bridge = new BridgeBackend();
    
    try {
      const isHealthy = await bridge.healthCheck();
      if (isHealthy) {
        console.log('[INFO] Bridge server found, using real system access');
        this.backend = bridge;
        this.useBridge = true;
        this.updateBridgeStatus('connecting');
        this.updateWebSocketStatus('connecting');
        
        // Check for Linux Files access
        const linuxFilesPath = await this.checkLinuxFilesAccess();
        if (linuxFilesPath) {
          this.terminal.write(`\r\n\x1b[32m[INFO]\x1b[0m Linux Files access detected: ${linuxFilesPath}\r\n`);
          this.terminal.write(`\x1b[33m[INFO]\x1b[0m Files will be saved to Linux Files folder when possible.\r\n`);
        }
        
        return;
      }
    } catch (error) {
      console.log('[INFO] Bridge server not available, will retry...');
    }
    
    // If bridge not available, try to connect in background
    this.updateBridgeStatus('disconnected');
    
    // Try connecting every 3 seconds
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
            
            // Show message to user
            this.terminal.write('\r\n\x1b[32m[INFO]\x1b[0m Connected to real system terminal!\r\n');
            this.terminal.write('\x1b[33m[INFO]\x1b[0m All commands now execute on your system.\r\n');
            this.writePrompt();
          }
        } catch (error) {
          // Continue trying
        }
      } else {
        clearInterval(bridgeRetryInterval);
      }
    }, 3000);
    
    // Fallback to Web Worker (browser-only, limited commands)
    this.backend = new WebWorkerBackendWrapper();
    this.useBridge = false;
    this.updateWebVMStatus('connecting');
    
    // Show helpful message about available commands
    this.terminal.write('\r\n\x1b[36m[INFO]\x1b[0m Running in browser mode\r\n');
    this.terminal.write('\x1b[33m[INFO]\x1b[0m Available commands: ls, cd, pwd, echo, cat, clear, help, @ai\r\n');
    this.terminal.write('\x1b[33m[INFO]\x1b[0m AI Assistant (@ai) is always available!\r\n');
    this.terminal.write('\x1b[33m[INFO]\x1b[0m To enable full system commands, start the bridge server:\r\n');
    this.terminal.write('\x1b[36m[INFO]\x1b[0m   cd bridge && npm install && npm start\r\n');
    this.terminal.write('\x1b[33m[INFO]\x1b[0m The terminal will auto-connect when bridge is available.\r\n');
  }

  private async setupBackend(): Promise<void> {
    if (!this.backend) {
      await this.initializeBackend();
    }
    
    try {
      if (this.useBridge) {
        this.terminal.write('\r\n\x1b[33m[INFO]\x1b[0m Connecting to Clay Terminal Bridge...\r\n');
        this.terminal.write('\x1b[32m[INFO]\x1b[0m Real system command execution enabled!\r\n');
        this.terminal.write('\x1b[32m[INFO]\x1b[0m Full terminal access - alternative to Crostini/Crosh\r\n');
        this.terminal.write('\x1b[32m[INFO]\x1b[0m All commands execute on your ChromeOS system.\r\n');
        
        // Show Linux Files status
        const linuxFilesPath = await this.checkLinuxFilesAccess();
        if (linuxFilesPath) {
          this.terminal.write(`\x1b[36m[Files]\x1b[0m Linux Files folder: ${linuxFilesPath}\r\n`);
        }
      } else {
        this.terminal.write('\r\n\x1b[33m[INFO]\x1b[0m Running in browser mode (limited commands)\r\n');
        this.terminal.write('\x1b[33m[INFO]\x1b[0m Start bridge server for full terminal access.\r\n');
        this.terminal.write('\x1b[33m[INFO]\x1b[0m Run: cd bridge && npm install && npm start\r\n');
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

  private handleTabCompletion(): void {
    if (!this.currentLine.trim()) return;
    
    const parts = this.currentLine.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1];
    
    // Simple file/directory completion
    if (lastPart.includes('/') || lastPart === '.' || lastPart === '..') {
      // Path completion - would need file system access
      this.terminal.write('\x07'); // Bell sound
      return;
    }
    
    // Command completion
    const commonCommands = ['ls', 'cd', 'pwd', 'cat', 'echo', 'clear', 'help', 'mkdir', 'touch', 'rm', 'mv', 'cp', 'grep', 'find', 'ps', 'kill', 'top', 'htop', 'nano', 'vim', 'git', 'npm', 'node', 'python', 'python3', 'bash', 'sh', 'curl', 'wget'];
    const matches = commonCommands.filter(cmd => cmd.startsWith(lastPart.toLowerCase()));
    
    if (matches.length === 1) {
      // Single match - complete it
      const completion = matches[0].substring(lastPart.length);
      this.currentLine += completion;
      this.terminal.write(completion);
    } else if (matches.length > 1) {
      // Multiple matches - show options
      this.terminal.write('\r\n');
      matches.forEach(cmd => {
        this.terminal.write(`  ${cmd}`);
      });
      this.terminal.write('\r\n');
      this.writePrompt();
      this.terminal.write(this.currentLine);
    } else {
      this.terminal.write('\x07'); // Bell sound for no match
    }
  }
  
  private startHistorySearch(): void {
    this.historySearchMode = true;
    this.historySearchQuery = '';
    this.terminal.write('\r\n\x1b[33m(reverse-i-search)\'\'\x1b[0m: ');
  }
  
  private cancelHistorySearch(): void {
    this.historySearchMode = false;
    this.historySearchQuery = '';
    this.terminal.write('\r\n');
    this.writePrompt();
    this.terminal.write(this.currentLine);
  }
  
  private handleLocalCommand(data: string): void {
    // Handle history search mode
    if (this.historySearchMode) {
      if (data === '\r' || data === '\n') {
        // Execute found command
        this.historySearchMode = false;
        const matches = this.commandHistory.filter(cmd => 
          cmd.toLowerCase().includes(this.historySearchQuery.toLowerCase())
        );
        if (matches.length > 0) {
          this.currentLine = matches[matches.length - 1];
          this.terminal.write('\r\n');
          this.writePrompt();
          this.terminal.write(this.currentLine);
        } else {
          this.terminal.write('\r\n');
          this.writePrompt();
        }
        this.historySearchQuery = '';
      } else if (data === '\x7f' || data === '\b') {
        // Backspace in search
        if (this.historySearchQuery.length > 0) {
          this.historySearchQuery = this.historySearchQuery.slice(0, -1);
          this.terminal.write('\b \b');
          this.updateHistorySearch();
        }
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        // Add character to search
        this.historySearchQuery += data;
        this.terminal.write(data);
        this.updateHistorySearch();
      }
      return;
    }
    
    // Handle special keys
    if (data === '\r' || data === '\n') {
      // Enter pressed - prevent page scrolling
      this.terminal.write('\r\n');
      const command = this.currentLine.trim();
      
      if (command) {
        this.commandHistory.push(command);
        if (this.commandHistory.length > 1000) {
          this.commandHistory.shift();
        }
        this.historyIndex = -1;
        this.executeCommand(command);
      } else {
        this.writePrompt();
      }
      
      this.currentLine = '';
      this.autocompleteIndex = -1;
      this.autocompleteSuggestions = [];
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
  
  private updateHistorySearch(): void {
    const matches = this.commandHistory.filter(cmd => 
      cmd.toLowerCase().includes(this.historySearchQuery.toLowerCase())
    );
    
    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      // Show search result
      this.terminal.write(`\r\x1b[K\x1b[33m(reverse-i-search)\'${this.historySearchQuery}\'\x1b[0m: ${match}`);
    } else {
      this.terminal.write(`\r\x1b[K\x1b[33m(reverse-i-search)\'${this.historySearchQuery}\'\x1b[0m: `);
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
      this.terminal.write(`\r\n\x1b[36m╔════════════════════════════════════════╗\x1b[0m\r\n`);
      this.terminal.write(`\x1b[36m║\x1b[0m  \x1b[1mClay Terminal - Available Commands\x1b[0m  \x1b[36m║\x1b[0m\r\n`);
      this.terminal.write(`\x1b[36m╚════════════════════════════════════════╝\x1b[0m\r\n\r\n`);
      
      this.terminal.write(`\x1b[33mBasic Commands:\x1b[0m\r\n`);
      this.terminal.write(`  \x1b[32mclear\x1b[0m, \x1b[32mcls\x1b[0m     - Clear terminal screen\r\n`);
      this.terminal.write(`  \x1b[32mhelp\x1b[0m               - Show this help message\r\n`);
      this.terminal.write(`  \x1b[32m@ai <question>\x1b[0m    - Ask AI assistant (always available)\r\n`);
      this.terminal.write(`  \x1b[32msearch <query>\x1b[0m     - Web search (uses SearXNG or LangSearch)\r\n`);
      this.terminal.write(`  \x1b[32m@search <query>\x1b[0m   - Web search (alternative syntax)\r\n\r\n`);
      
      // Show device-specific commands
      if (this.useBridge) {
        this.terminal.write(`\x1b[33mSystem Commands (Full Access):\x1b[0m\r\n`);
        this.terminal.write(`  All standard Unix/Linux commands available\r\n`);
        this.terminal.write(`  Full bash shell with real system access\r\n\r\n`);
      } else {
        this.terminal.write(`\x1b[33mBrowser Commands:\x1b[0m\r\n`);
        this.terminal.write(`  \x1b[32mls\x1b[0m      - List files and directories\r\n`);
        this.terminal.write(`  \x1b[32mcd\x1b[0m      - Change directory\r\n`);
        this.terminal.write(`  \x1b[32mpwd\x1b[0m     - Print working directory\r\n`);
        this.terminal.write(`  \x1b[32mecho\x1b[0m    - Echo text to terminal\r\n`);
        this.terminal.write(`  \x1b[32mcat\x1b[0m     - Display file contents\r\n`);
        this.terminal.write(`  \x1b[32mtouch\x1b[0m   - Create empty file\r\n`);
        this.terminal.write(`  \x1b[32mmkdir\x1b[0m   - Create directory\r\n`);
        this.terminal.write(`  \x1b[32mrm\x1b[0m      - Remove file/directory\r\n\r\n`);
        this.terminal.write(`\x1b[33mNote:\x1b[0m Start bridge server for full system access\r\n\r\n`);
      }
      
      this.terminal.write(`\x1b[33mKeyboard Shortcuts:\x1b[0m\r\n`);
      this.terminal.write(`  \x1b[32mTab\x1b[0m          - Command/file completion\r\n`);
      this.terminal.write(`  \x1b[32mCtrl+R\x1b[0m       - Reverse history search\r\n`);
      this.terminal.write(`  \x1b[32mCtrl+C\x1b[0m       - Copy selection or interrupt\r\n`);
      this.terminal.write(`  \x1b[32mCtrl+V\x1b[0m       - Paste from clipboard\r\n`);
      this.terminal.write(`  \x1b[32m↑/↓\x1b[0m          - Command history navigation\r\n\r\n`);
      
      this.terminal.write(`\x1b[33mSearch Features:\x1b[0m\r\n`);
      this.terminal.write(`  \x1b[32msearch <query>\x1b[0m - Web search (auto-switches based on CPU)\r\n`);
      this.terminal.write(`  \x1b[36m  • SearXNG\x1b[0m - Self-hosted when CPU < ${this.CPU_THRESHOLD}%\r\n`);
      this.terminal.write(`  \x1b[36m  • LangSearch\x1b[0m - API-based when CPU > ${this.CPU_THRESHOLD}%\r\n\r\n`);
      
      this.writePrompt();
      return;
    }

    if (command.startsWith('search ') || command.startsWith('@search ')) {
      const query = command.startsWith('search ') 
        ? command.substring(7).trim() 
        : command.substring(8).trim();
      
      if (!query) {
        this.terminal.write(`\r\n\x1b[33m[Usage]\x1b[0m search <query> or @search <query>\r\n`);
        this.terminal.write(`\x1b[33m[Example]\x1b[0m search python tutorial\r\n`);
        this.writePrompt();
        return;
      }
      
      await this.performWebSearch(query);
      this.writePrompt();
      return;
    }

    if (command.startsWith('@ai ')) {
      const question = command.substring(4).trim();
      
      // Ensure AI assistant is always available
      if (!this.aiAssistant) {
        try {
          this.aiAssistant = new SimpleAIAssistant();
        } catch (error) {
          this.terminal.write(`\r\n\x1b[31m[ERROR]\x1b[0m Failed to initialize AI assistant: ${error}\r\n`);
          this.writePrompt();
          return;
        }
      }
      
      // Handle special AI commands
      if (question === 'enable') {
        this.aiControlEnabled = true;
        this.terminal.write(`\r\n\x1b[32m[AI]\x1b[0m AI control enabled - AI will auto-execute commands\r\n`);
        this.updateAIStatus('ready');
        this.writePrompt();
        return;
      } else if (question === 'disable') {
        this.aiControlEnabled = false;
        this.terminal.write(`\r\n\x1b[33m[AI]\x1b[0m AI control disabled - manual execution required\r\n`);
        this.updateAIStatus('idle');
        this.writePrompt();
        return;
      } else if (question === 'status') {
        this.terminal.write(`\r\n\x1b[36m[AI Status]\x1b[0m Control: ${this.aiControlEnabled ? 'ENABLED' : 'DISABLED'}\r\n`);
        this.terminal.write(`\x1b[36m[AI Status]\x1b[0m Model: ${this.aiAssistant.getCurrentModel()}\r\n`);
        this.terminal.write(`\x1b[36m[Session]\x1b[0m Commands: ${this.sessionCommands.length}\r\n`);
        this.writePrompt();
        return;
      } else if (question === 'share' || question === 'share link') {
        await this.copyShareLink();
        return;
      }
      
      if (!question) {
        this.terminal.write(`\r\n\x1b[33m[INFO]\x1b[0m Usage: @ai <question>\r\n`);
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m Examples:\r\n`);
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m   @ai what is bash?\r\n`);
        this.terminal.write(`\x1b[33m[INFO]\x1b[0m   @ai enable adb connection\r\n`);
        this.writePrompt();
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
      // Backend - commands are sent in real-time via WebSocket
      // This works for both bridge (real system) and WebWorker (limited)
      this.backend.sendInput(command + '\r\n');
      
      // For bridge, commands are executed in real-time via PTY
      // For WebWorker, commands are handled by the worker
      // No need to call executeViaREST - real-time is better
    } else {
      // Backend not connected - try to execute via REST as fallback
      // But first, try to reconnect
      if (!this.backend) {
        await this.initializeBackend();
      }
      
      if (this.backend && this.backend.getConnected()) {
        this.backend.sendInput(command + '\r\n');
      } else {
        // Last resort: try REST execution
        await this.executeViaREST(command);
      }
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
    // Ensure AI assistant is always available
    if (!this.aiAssistant) {
      try {
        this.aiAssistant = new SimpleAIAssistant();
      } catch (error) {
        this.terminal.write(`\r\n\x1b[31m[ERROR]\x1b[0m AI assistant initialization failed. Please refresh the page.\r\n`);
        this.writePrompt();
        return;
      }
    }
    
    this.aiExecuting = true;
    this.updateAIStatus('thinking');
    
    try {
      // Detect if this is a command request (action) vs a question
      const isCommandRequest = this.isCommandRequest(question);
      
      // Check if question might need web search
      const needsSearch = this.shouldPerformSearch(question);
      let searchContext = '';
      
      if (needsSearch) {
        this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Performing web search for better context...\r\n`);
        const searchQuery = this.extractSearchQuery(question);
        searchContext = await this.searchForAI(searchQuery);
      }
      
      if (isCommandRequest) {
        // Silent execution mode - just do it, don't explain
        this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Executing...\r\n`);
        const prompt = searchContext 
          ? `User wants to: ${question}.\n\nContext from web search:\n${searchContext}\n\nProvide ONLY the command(s) to execute, no explanations. Format in code blocks.`
          : `User wants to: ${question}. Provide ONLY the command(s) to execute, no explanations. Format in code blocks.`;
        
        const response = await this.aiAssistant.askQuestion(
          prompt,
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
        const prompt = searchContext 
          ? `${question}\n\nUse this context from web search to provide accurate information:\n${searchContext}\n\nIf the search results are relevant, reference them in your answer.`
          : question;
        
        const response = await this.aiAssistant.askQuestion(prompt, this.currentDirectory, this.commandHistory);
        
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
      this.terminal.write(`\r\n\x1b[31m[AI ERROR]\x1b[0m ${error.message || 'Failed to connect to AI service'}\r\n`);
      this.terminal.write(`\x1b[33m[INFO]\x1b[0m AI service may be unavailable. Please try again.\r\n`);
      this.updateAIStatus('error');
      setTimeout(() => {
        this.updateAIStatus(this.aiControlEnabled ? 'ready' : 'idle');
      }, 3000);
    } finally {
      this.aiExecuting = false;
      if (this.aiAssistant) {
        this.updateAIStatus(this.aiControlEnabled ? 'ready' : 'idle');
      }
      this.writePrompt();
    }
  }
  
  private shouldPerformSearch(question: string): boolean {
    const searchKeywords = [
      'latest', 'recent', 'current', 'news', 'what is', 'who is', 'when did', 'where is',
      'how to', 'tutorial', 'guide', 'explain', 'tell me about', 'information about',
      'search', 'find', 'look up', 'web', 'online', 'internet', 'google', 'wikipedia'
    ];
    
    const lowerQuestion = question.toLowerCase();
    return searchKeywords.some(keyword => lowerQuestion.includes(keyword));
  }
  
  private extractSearchQuery(question: string): string {
    // Remove AI-specific prefixes and extract the actual query
    let query = question
      .replace(/^search\s+for\s+/i, '')
      .replace(/^find\s+/i, '')
      .replace(/^look\s+up\s+/i, '')
      .replace(/^what\s+is\s+/i, '')
      .replace(/^who\s+is\s+/i, '')
      .replace(/^tell\s+me\s+about\s+/i, '')
      .replace(/^information\s+about\s+/i, '')
      .replace(/^explain\s+/i, '')
      .trim();
    
    // If query is empty or too short, use the original question
    if (!query || query.length < 3) {
      query = question;
    }
    
    return query;
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
    this.terminal.write(`\x1b[1m\x1b[36m╔═══════════════════════════════════════════════════════╗\x1b[0m\r\n`);
    this.terminal.write(`\x1b[1m\x1b[36m║\x1b[0m  \x1b[1m\x1b[34mClay Terminal\x1b[0m - Professional Web Terminal              \x1b[1m\x1b[36m║\x1b[0m\r\n`);
    this.terminal.write(`\x1b[1m\x1b[36m╚═══════════════════════════════════════════════════════╝\x1b[0m\r\n`);
    this.terminal.write('\r\n');
    this.terminal.write(`  \x1b[32m✓\x1b[0m \x1b[36mAI Assistant\x1b[0m always available - Type \x1b[33m@ai <question>\x1b[0m\r\n`);
    this.terminal.write(`  \x1b[32m✓\x1b[0m \x1b[36mWeb Search\x1b[0m - Type \x1b[33msearch <query>\x1b[0m or \x1b[33m@search <query>\x1b[0m\r\n`);
    this.terminal.write(`  \x1b[32m✓\x1b[0m \x1b[36mTab Completion\x1b[0m - Press Tab for command/file completion\r\n`);
    this.terminal.write(`  \x1b[32m✓\x1b[0m \x1b[36mHistory Search\x1b[0m - Press \x1b[33mCtrl+R\x1b[0m to search command history\r\n`);
    this.terminal.write(`  \x1b[32m✓\x1b[0m \x1b[36mFile Operations\x1b[0m - touch, mkdir, rm, mv, cp supported\r\n`);
    this.terminal.write(`  \x1b[32m✓\x1b[0m Type \x1b[33mhelp\x1b[0m for all available commands\r\n`);
    this.terminal.write(`  \x1b[32m✓\x1b[0m Commands adapt to your device capabilities\r\n`);
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
  private readonly API_KEY = 'unused'; // llm7.io doesn't require API key for public models
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

      // llm7.io API call - no auth required for public models
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: llm7.io may not require Authorization header for free tier
          ...(this.API_KEY !== 'unused' ? { 'Authorization': `Bearer ${this.API_KEY}` } : {})
        },
        body: JSON.stringify({
          model: this.currentModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          const errorData = await response.json();
          errorText = errorData.error?.message || errorData.message || JSON.stringify(errorData);
        } catch {
          errorText = await response.text().catch(() => `HTTP ${response.status}`);
        }
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from AI API');
      }
      
      const assistantResponse = data.choices[0].message.content || 'No response generated';
      
      if (!assistantResponse || assistantResponse.trim().length === 0) {
        throw new Error('Empty response from AI');
      }
      
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });
      
      if (this.conversationHistory.length > 30) {
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-20)
        ];
      }
      
      return assistantResponse;
    } catch (error: any) {
      // Better error handling
      const errorMessage = error.message || 'Unknown error occurred';
      console.error('AI API Error:', error);
      
      // Reset conversation history on persistent errors
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        this.conversationHistory = [this.conversationHistory[0]]; // Keep system message
      }
      
      throw new Error(`Failed to get AI response: ${errorMessage}`);
    }
  }

  public async quickFix(command: string, error: string): Promise<string | null> {
    try {
      const prompt = `The command "${command}" failed with this error:\n${error}\n\nProvide ONLY the exact command to fix this issue. Format it in a code block like \`\`\`bash\nfix-command\n\`\`\`. Do not include explanations, just the fix command.`;
      const response = await this.askQuestion(prompt);
      const commands = this.extractCommand(response);
      return commands.length > 0 ? commands[0] : null;
    } catch (error: any) {
      console.error('Quick fix error:', error);
      // Return a simple fallback or null
      return null;
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
    title.textContent = 'Clay';
    
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
    try {
      // Wait a bit to ensure DOM is ready
      setTimeout(() => {
        const terminalElement = document.getElementById('terminal');
        if (!terminalElement) {
          console.error('Terminal element not found, retrying...');
          setTimeout(() => this.initializeTerminal(), 100);
          return;
        }
        
        this.terminal = new ClayWebTerminal();
        
        // Hide loading overlay after terminal is initialized
        setTimeout(() => {
          const loading = document.getElementById('loading');
          if (loading) {
            loading.classList.add('hidden');
          }
        }, 500);
      }, 100);
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      const loading = document.getElementById('loading');
      if (loading) {
        loading.innerHTML = '<p>Failed to initialize terminal. Please refresh the page.</p>';
      }
    }
  }
  
  public getTerminal(): ClayWebTerminal | null {
    return this.terminal;
  }
}

// New Landing + Terminal router using Tailwind CSS
initializeHTML();

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateAllThemeIcons();
}

function initTheme() {
  // Default to dark mode
  const saved = localStorage.getItem('theme');
  const shouldBeDark = saved === 'light' ? false : true; // Default to dark unless explicitly set to light
  
  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function updateAllThemeIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  
  // Landing page icons
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');
  if (sunIcon && moonIcon) {
    if (isDark) {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    } else {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    }
  }
  
  // Terminal page icons
  const sunIconTerminal = document.getElementById('sun-icon-terminal');
  const moonIconTerminal = document.getElementById('moon-icon-terminal');
  if (sunIconTerminal && moonIconTerminal) {
    if (isDark) {
      sunIconTerminal.classList.add('hidden');
      moonIconTerminal.classList.remove('hidden');
    } else {
      sunIconTerminal.classList.remove('hidden');
      moonIconTerminal.classList.add('hidden');
    }
  }
}

let deferredPrompt: any = null;
let isInstalled = false;

// Check if app is already installed
if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
  isInstalled = true;
}

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e;
  updateInstallButton();
});

// Listen for app installed event
window.addEventListener('appinstalled', () => {
  isInstalled = true;
  deferredPrompt = null;
  updateInstallButton();
  showInstallSuccess();
});

function updateInstallButton() {
  const installBtn = document.getElementById('install-pwa-btn');
  if (installBtn) {
    if (isInstalled) {
      installBtn.style.display = 'none';
    } else if (deferredPrompt) {
      installBtn.style.display = 'block';
    } else {
      installBtn.style.display = 'none';
    }
  }
}

function showInstallSuccess() {
  const root = document.getElementById('app-root');
  if (!root) return;
  
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 z-50';
  toast.innerHTML = `
    <div class="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      <span>Clay Terminal installed successfully!</span>
    </div>
  `;
  root.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderLanding(): void {
  const root = document.getElementById('app-root')!;
  root.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'min-h-screen flex flex-col';

  const navbar = document.createElement('nav');
  navbar.className = 'glass border-b border-white/10 px-6 py-4 animate-fade-in';
  navbar.innerHTML = `
    <div class="flex items-center justify-between max-w-7xl mx-auto">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span class="text-white font-bold text-lg">C</span>
        </div>
        <h1 class="text-2xl font-bold text-white">Clay Terminal</h1>
      </div>
      <div class="flex items-center gap-3">
        <button id="install-pwa-btn" class="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 border border-blue-500/50" style="display: none;">
          Install App
        </button>
        <button id="theme-toggle" class="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all border border-gray-700/50 hover:scale-105">
          <svg id="sun-icon" class="w-5 h-5 text-gray-300 dark:hidden" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
          </svg>
          <svg id="moon-icon" class="w-5 h-5 text-gray-300 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const hero = document.createElement('div');
  hero.className = 'flex-1 flex items-center justify-center px-6 py-20 relative overflow-hidden';
  hero.innerHTML = `
    <div class="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-pulse-slow"></div>
    <div class="text-center max-w-4xl mx-auto relative z-10 animate-fade-in">
      <div class="mb-6">
        <div class="inline-block p-4 rounded-2xl glass mb-4">
          <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
            <span class="text-white font-bold text-3xl">C</span>
          </div>
        </div>
      </div>
      <h1 class="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
        Professional Terminal for the Web
      </h1>
      <p class="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
        Clay gives you a powerful, AI-augmented terminal experience right in your browser. Full system access, tab completion, history search, and more.
      </p>
      <div class="flex gap-4 justify-center flex-wrap">
        <button id="open-terminal" class="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg shadow-2xl hover:shadow-blue-500/50 transition-all transform hover:scale-105 border border-blue-400/50">
          Open Terminal
        </button>
        <a href="https://www.npmjs.com/package/clay-util" target="_blank" class="px-8 py-4 glass hover:bg-gray-800/70 border border-white/20 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
          Documentation
        </a>
        <button id="install-pwa-btn-hero" class="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-semibold text-lg shadow-2xl hover:shadow-green-500/50 transition-all transform hover:scale-105 border border-green-400/50" style="display: none;">
          📱 Install App
        </button>
      </div>
    </div>
  `;

  const dashboard = document.createElement('div');
  dashboard.className = 'px-6 py-12 relative';
  dashboard.innerHTML = `
    <div class="max-w-7xl mx-auto">
      <div class="grid gap-6 md:grid-cols-3">
        <div class="glass rounded-2xl shadow-2xl p-6 border border-white/10 hover:border-white/20 transition-all animate-fade-in">
          <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Now
          </h2>
          <div id="clock" class="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"></div>
          <div id="date" class="text-sm text-gray-400"></div>
        </div>
        <div class="glass rounded-2xl shadow-2xl p-6 border border-white/10 hover:border-white/20 transition-all md:col-span-2 animate-fade-in">
          <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Latest Updates
          </h2>
          <ul class="space-y-3 text-gray-300" id="updates-list">
            <li class="flex items-start gap-3">
              <span class="text-blue-400 mt-1 font-bold">▸</span>
              <span><span class="text-white font-medium">Tab Completion</span> - Press Tab for command/file autocomplete</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-blue-400 mt-1 font-bold">▸</span>
              <span><span class="text-white font-medium">History Search</span> - Ctrl+R for reverse command search</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-blue-400 mt-1 font-bold">▸</span>
              <span><span class="text-white font-medium">File Operations</span> - touch, mkdir, rm, mv, cp commands</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-blue-400 mt-1 font-bold">▸</span>
              <span><span class="text-white font-medium">Enhanced UI</span> - Glassmorphism design with animations</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-blue-400 mt-1 font-bold">▸</span>
              <span><span class="text-white font-medium">Status Bar</span> - Real-time status indicators with OS/CPU info</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;

  wrapper.appendChild(navbar);
  wrapper.appendChild(hero);
  wrapper.appendChild(dashboard);
  root.appendChild(wrapper);

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleDarkMode);
  }
  
  // Update theme icons
  function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    if (sunIcon && moonIcon) {
      if (isDark) {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }
    }
  }
  
  updateThemeIcons();
  
  // Also update on theme toggle
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      setTimeout(updateThemeIcons, 10);
    });
  }

  const openBtn = document.getElementById('open-terminal') as HTMLButtonElement;
  openBtn.addEventListener('click', () => {
    location.hash = '#terminal';
    renderTerminalView();
  });

  // PWA Install handlers
  const installBtnNav = document.getElementById('install-pwa-btn') as HTMLButtonElement;
  const installBtnHero = document.getElementById('install-pwa-btn-hero') as HTMLButtonElement;
  
  async function handleInstall() {
    if (!deferredPrompt) {
      // Already installed or not available
      if (isInstalled) {
        showInstallSuccess();
      }
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    deferredPrompt = null;
    updateInstallButton();
    if (installBtnHero) installBtnHero.style.display = 'none';
  }
  
  if (installBtnNav) {
    installBtnNav.addEventListener('click', handleInstall);
  }
  if (installBtnHero) {
    installBtnHero.addEventListener('click', handleInstall);
  }
  
  updateInstallButton();
  if (installBtnHero) {
    if (isInstalled) {
      installBtnHero.style.display = 'none';
    } else if (deferredPrompt) {
      installBtnHero.style.display = 'block';
    }
  }

  function tickClock() {
    const now = new Date();
    const timeEl = document.getElementById('clock')!;
    const dateEl = document.getElementById('date')!;
    timeEl.textContent = now.toLocaleTimeString();
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  tickClock();
  setInterval(tickClock, 1000);
}

function renderTerminalView(): void {
  const root = document.getElementById('app-root')!;
  root.innerHTML = '';
  const layout = document.createElement('div');
  layout.className = 'min-h-screen flex flex-col bg-gray-950';
  layout.innerHTML = `
    <!-- Enhanced Status Bar with Glassmorphism -->
    <div id="status-bar" class="glass px-4 py-2.5 animate-fade-in">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 flex-wrap">
          <!-- Back Button -->
          <button id="back-home" class="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 hover:scale-105 border border-gray-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Dashboard
          </button>
          
          <!-- Status Indicators with Icons -->
          <div class="flex items-center gap-2">
            <div id="webvm-status" class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-all">
              <div id="webvm-dot" class="w-2 h-2 rounded-full bg-gray-500"></div>
              <span id="webvm-text" class="text-xs text-gray-300 font-medium">WebVM</span>
            </div>
            
            <div id="bridge-status" class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-all">
              <div id="bridge-dot" class="w-2 h-2 rounded-full bg-gray-500"></div>
              <span id="bridge-text" class="text-xs text-gray-300 font-medium">Bridge</span>
            </div>
            
            <div id="websocket-status" class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-all">
              <div id="websocket-dot" class="w-2 h-2 rounded-full bg-gray-500"></div>
              <span id="websocket-text" class="text-xs text-gray-300 font-medium">WS</span>
            </div>
            
            <div id="ai-status" class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-all">
              <div id="ai-dot" class="w-2 h-2 rounded-full bg-gray-500"></div>
              <span id="ai-text" class="text-xs text-gray-300 font-medium">AI</span>
            </div>
            
            <div id="os-info" class="px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <span id="os-text" class="text-xs text-gray-300 font-medium">OS: Unknown</span>
            </div>
            
            <div id="cpu-usage" class="px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <span id="cpu-text" class="text-xs text-gray-300 font-medium">CPU: --</span>
            </div>
            
            <div id="search-status" class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-all">
              <div id="search-dot" class="w-2 h-2 rounded-full bg-gray-500"></div>
              <span id="search-text" class="text-xs text-gray-300 font-medium">Search: --</span>
            </div>
          </div>
        </div>
        
        <!-- Right Side Actions -->
        <div class="flex items-center gap-2">
          <!-- Model Selector -->
          <select id="model-select" class="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 rounded-lg text-xs font-medium border border-gray-700/50 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="codestral-2501">Codestral 2501</option>
            <option value="mistral-small-3.1-24b-instruct-2503">Mistral Small</option>
            <option value="deepseek-v3.1">DeepSeek V3.1</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
            <option value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano</option>
            <option value="gpt-5-chat">GPT-5 Chat</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5</option>
            <option value="codestral-2405">Codestral 2405</option>
          </select>
          
          <!-- Theme Toggle -->
          <button id="theme-toggle-terminal" class="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all border border-gray-700/50 hover:scale-105">
            <svg id="sun-icon-terminal" class="w-4 h-4 text-gray-400 dark:hidden" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
            </svg>
            <svg id="moon-icon-terminal" class="w-4 h-4 text-gray-400 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Enhanced Terminal Container with Glassmorphism -->
    <div class="flex-1 overflow-hidden p-4">
      <div id="terminal" class="w-full h-full glass rounded-xl shadow-2xl animate-fade-in"></div>
    </div>
  `;
  root.appendChild(layout);

  const themeToggle = document.getElementById('theme-toggle-terminal');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleDarkMode);
  }
  
  // Update theme icons
  function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    const sunIcon = document.getElementById('sun-icon-terminal');
    const moonIcon = document.getElementById('moon-icon-terminal');
    if (sunIcon && moonIcon) {
      if (isDark) {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }
    }
  }
  
  updateThemeIcons();
  
  // Also update on theme toggle
  const themeToggleBtnTerminal = document.getElementById('theme-toggle-terminal');
  if (themeToggleBtnTerminal) {
    themeToggleBtnTerminal.addEventListener('click', () => {
      setTimeout(updateThemeIcons, 10);
    });
  }

  const back = document.getElementById('back-home') as HTMLButtonElement;
  back.addEventListener('click', () => {
    location.hash = '';
    renderLanding();
  });

  // Initialize terminal into #terminal
  setTimeout(() => {
    try {
      new (ClayWebTerminal as any)();
    } catch (e) {
      console.error(e);
    }
  }, 50);
}

function route() {
  initTheme();
  if (location.hash === '#terminal') {
    renderTerminalView();
  } else {
    renderLanding();
  }
}

window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', route);

