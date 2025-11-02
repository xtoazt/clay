interface ElectronAPI {
  executeCommand: (command: string, cwd?: string) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>;
  executeCommandStream: (command: string, cwd?: string) => Promise<any>;
  createPtySession?: (cwd?: string, cols?: number, rows?: number) => Promise<any>;
  getCurrentDirectory: () => Promise<string>;
  changeDirectory: (dir: string) => Promise<{ success: boolean; cwd?: string; error?: string }>;
  getHomeDirectory: () => Promise<string>;
  getPlatform: () => Promise<string>;
  hasPtySupport?: () => Promise<boolean>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  onTerminalResize?: (callback: (size: { cols: number; rows: number }) => void) => void;
}

// Make this file a module
export {};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    clayTerminal: ClayTerminal;
    aiAssistant: SimpleAIAssistant;
  }
}

class ClayTerminal {
  private outputContainer: HTMLElement;
  private commandInput: HTMLInputElement;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentDirectory: string = '';
  private homeDirectory: string = '';
  private platform: string = '';
  private isExecuting: boolean = false;
  private lastError: { command: string; error: string; timestamp: number } | null = null;
  private recentOutput: string[] = [];
  private ptySession: any = null;
  private hasPty: boolean = false;
  private useRealTerminal: boolean = false;

  constructor() {
    const outputEl = document.getElementById('terminal-output');
    const inputEl = document.getElementById('command-input');
    
    if (!outputEl || !inputEl) {
      throw new Error('Required DOM elements not found');
    }
    
    this.outputContainer = outputEl;
    this.commandInput = inputEl as HTMLInputElement;
    this.initializeTerminal();
  }

  // Public methods for AI Assistant
  public async executeCommandForAI(command: string): Promise<string> {
    this.commandInput.value = command;
    await this.executeCommand(command);
    return this.getLastOutput();
  }

  public getLastError(): { command: string; error: string } | null {
    return this.lastError;
  }

  public getRecentOutput(): string {
    return this.recentOutput.slice(-10).join('\n');
  }

  public getCurrentDirectory(): string {
    return this.currentDirectory;
  }

  private getLastOutput(): string {
    const lines = Array.from(this.outputContainer.querySelectorAll('.terminal-line'))
      .slice(-5)
      .map(el => el.textContent || '')
      .join('\n');
    return lines;
  }

  private async initializeTerminal(): Promise<void> {
    await Promise.all([
      this.updateDirectory(),
      this.loadHomeDirectory(),
      this.loadPlatform(),
      this.checkPtySupport(),
    ]);
    this.setupEventListeners();
    this.setupWindowControls();
    this.setupTerminalResize();
    this.printWelcomeMessage();
  }

  private async checkPtySupport(): Promise<void> {
    try {
      if (window.electronAPI?.hasPtySupport) {
        this.hasPty = await window.electronAPI.hasPtySupport();
        if (this.hasPty) {
          // Optionally create PTY session for real terminal experience
          // For now, we'll use it for interactive commands
        }
      }
    } catch (error) {
      console.warn('PTY check failed:', error);
      this.hasPty = false;
    }
  }

  private setupTerminalResize(): void {
    if (window.electronAPI?.onTerminalResize) {
      window.electronAPI.onTerminalResize((size) => {
        if (this.ptySession && this.ptySession.resize) {
          this.ptySession.resize(size.cols, size.rows);
        }
      });
    }
  }

  private async loadHomeDirectory(): Promise<void> {
    try {
      if (window.electronAPI) {
        this.homeDirectory = await window.electronAPI.getHomeDirectory();
      }
    } catch (error) {
      console.error('Failed to get home directory:', error);
    }
  }

  private async loadPlatform(): Promise<void> {
    try {
      if (window.electronAPI) {
        this.platform = await window.electronAPI.getPlatform();
      }
    } catch (error) {
      console.error('Failed to get platform:', error);
    }
  }

  private setupWindowControls(): void {
    const closeBtn = document.querySelector('.control.close');
    const minimizeBtn = document.querySelector('.control.minimize');
    const maximizeBtn = document.querySelector('.control.maximize');

    closeBtn?.addEventListener('click', () => {
      if (window.electronAPI) {
        window.electronAPI.windowClose();
      }
    });

    minimizeBtn?.addEventListener('click', () => {
      if (window.electronAPI) {
        window.electronAPI.windowMinimize();
      }
    });

    maximizeBtn?.addEventListener('click', () => {
      if (window.electronAPI) {
        window.electronAPI.windowMaximize();
      }
    });
  }

  private printWelcomeMessage(): void {
    this.addOutputLine('Clay Terminal', 'info');
    this.addOutputLine('A beautiful terminal experience', 'info');
    this.addOutputLine('');
    this.addOutputLine('💡 Type @ai <question> to ask the AI, or just run commands normally', 'info');
    this.addOutputLine('');
    this.addPrompt();
  }

  private setupEventListeners(): void {
    this.commandInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.commandInput.addEventListener('input', () => {
      // Keep cursor visible while typing
    });
    this.commandInput.focus();

    // Focus input when clicking on terminal
    this.outputContainer.addEventListener('click', () => {
      this.commandInput.focus();
    });
  }

  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    // If we have an active PTY session, forward input to it
    if (this.ptySession && this.isExecuting) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.ptySession.write('\r');
        return;
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        this.ptySession.write('\b');
        return;
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.ptySession.write('\x03'); // Ctrl+C
        this.addOutputLine('^C', 'info');
        return;
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Forward printable characters
        this.ptySession.write(e.key);
        return;
      }
      // Forward arrow keys and special keys
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const arrowMap: { [key: string]: string } = {
          'ArrowUp': '\x1b[A',
          'ArrowDown': '\x1b[B',
          'ArrowRight': '\x1b[C',
          'ArrowLeft': '\x1b[D',
        };
        if (arrowMap[e.key]) {
          this.ptySession.write(arrowMap[e.key]);
        }
        return;
      }
    }

    if (this.isExecuting && e.key !== 'Enter') {
      return; // Ignore input while executing (unless it's a PTY session)
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const command = this.commandInput.value.trim();
      if (command) {
        await this.executeCommand(command);
      } else {
        this.addPrompt();
      }
      this.commandInput.value = '';
      this.historyIndex = -1;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigateHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab completion could be added here
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // Handle Ctrl+C for cancelling commands
      this.commandInput.value = '';
      this.addOutputLine('^C', 'info');
      this.addPrompt();
    }
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;

    if (direction === -1 && this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.commandInput.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
    } else if (direction === 1 && this.historyIndex > 0) {
      this.historyIndex--;
      this.commandInput.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
    } else if (direction === 1 && this.historyIndex === 0) {
      this.historyIndex = -1;
      this.commandInput.value = '';
    }
  }

  private formatPrompt(): string {
    let prompt = '';
    if (this.platform === 'win32') {
      prompt = this.currentDirectory || 'C:\\>';
    } else {
      const shortPath = this.currentDirectory.replace(this.homeDirectory, '~');
      prompt = `${shortPath} $`;
    }
    return prompt;
  }

  private async executeCommand(command: string): Promise<void> {
    if (this.isExecuting) return;
    
    this.commandHistory.push(command);
    if (this.commandHistory.length > 1000) {
      this.commandHistory.shift();
    }
    
    // Display the command
    this.addCommandLine(command);
    this.isExecuting = true;
    this.lastError = null; // Clear previous error

    // Handle @ai command
    if (command.startsWith('@ai ')) {
      const question = command.substring(4).trim();
      await this.handleAICommand(question);
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    // Handle built-in commands
    if (command === 'clear' || command === 'cls') {
      this.clearTerminal();
      this.isExecuting = false;
      return;
    }

    if (command === 'help') {
      this.showHelp();
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    if (command === 'pwd') {
      await this.updateDirectory();
      this.addOutputLine(this.currentDirectory, 'output');
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    // Handle cd command
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim() || this.homeDirectory;
      await this.handleChangeDirectory(dir);
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    // Execute shell command - try streaming first for interactive commands
    const needsStreaming = this.needsStreaming(command);
    
    if (needsStreaming) {
      await this.executeStreamingCommand(command);
    } else {
      await this.executeSimpleCommand(command);
    }

    this.isExecuting = false;
    this.addPrompt();
    await this.updateDirectory();
  }

  private needsStreaming(command: string): boolean {
    // Commands that need interactive/streaming output
    const streamingCommands = [
      'adb', 'npm', 'yarn', 'python', 'node', 'ssh', 'tail', 'top',
      'watch', 'ping', 'tcpdump', 'nc', 'netcat'
    ];
    const cmd = command.split(' ')[0].toLowerCase();
    return streamingCommands.some(sc => cmd.includes(sc));
  }

  private async executeStreamingCommand(command: string): Promise<void> {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI not available');
      }

      // Use PTY for better terminal emulation if available for interactive programs
      if (this.hasPty && window.electronAPI.createPtySession && 
          command.match(/^(vim|nano|htop|top|watch|python -i|node -i|irb|pry|bash -i|zsh -i)/)) {
        await this.executeWithPty(command);
        return;
      }
      
      const stream = await window.electronAPI.executeCommandStream(command, this.currentDirectory);
      
      let hasOutput = false;
      let outputText = '';

      stream.onOutput((data: string) => {
        hasOutput = true;
        outputText += data;
        // Process ANSI escape codes for colored output
        const processed = this.processAnsiCodes(data);
        const lines = processed.split('\n');
        lines.forEach((line: string) => {
          if (line.trim() || !hasOutput) {
            // Preserve original if it had ANSI codes
            if (data.includes('\x1b[')) {
              this.addOutputLineWithAnsi(line);
            } else {
              this.addOutputLine(line, 'output');
            }
            this.recentOutput.push(line);
            if (this.recentOutput.length > 50) {
              this.recentOutput.shift();
            }
          }
        });
      });

      stream.onClose((code: number) => {
        if (code !== 0) {
          this.addOutputLine(`Process exited with code ${code}`, 'error');
          this.lastError = {
            command,
            error: outputText || `Process exited with code ${code}`,
            timestamp: Date.now()
          };
          // Auto-show quick fix option
          this.showQuickFixOption();
        }
      });
    } catch (error: any) {
      this.addOutputLine(`Error: ${error.message}`, 'error');
      this.lastError = {
        command,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  private async executeWithPty(command: string): Promise<void> {
    if (!window.electronAPI?.createPtySession) return;

    try {
      const cols = Math.max(80, Math.floor(this.outputContainer.clientWidth / 8));
      const rows = Math.max(24, Math.floor(this.outputContainer.clientHeight / 16));
      
      this.ptySession = await window.electronAPI.createPtySession(this.currentDirectory, cols, rows);
      
      if (!this.ptySession) {
        // Fallback to regular execution
        const stream = await window.electronAPI.executeCommandStream(command, this.currentDirectory);
        // Handle fallback stream...
        return;
      }

      let outputText = '';

      this.ptySession.onData((data: string) => {
        outputText += data;
        this.addOutputLineWithAnsi(data);
        this.recentOutput.push(data);
        if (this.recentOutput.length > 50) {
          this.recentOutput.shift();
        }
      });

      this.ptySession.onExit((code: number) => {
        if (code !== 0) {
          this.lastError = {
            command,
            error: outputText || `Process exited with code ${code}`,
            timestamp: Date.now()
          };
          // Auto-show quick fix option
          this.showQuickFixOption();
        }
        this.ptySession = null;
        this.isExecuting = false;
        this.addPrompt();
      });

      // Write command to PTY
      this.ptySession.write(command + '\n');
    } catch (error: any) {
      console.error('PTY execution failed:', error);
      this.addOutputLine(`Error: ${error.message}`, 'error');
      this.lastError = {
        command,
        error: error.message,
        timestamp: Date.now()
      };
      // Auto-show quick fix option
      this.showQuickFixOption();
      this.isExecuting = false;
      this.addPrompt();
    }
  }

  private processAnsiCodes(text: string): string {
    // Basic ANSI code processing - strip codes but keep text readable
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private addOutputLineWithAnsi(text: string): void {
    const line = document.createElement('div');
    line.className = 'terminal-line output';
    
    // Create a pre element to preserve formatting and handle ANSI
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.fontFamily = 'inherit';
    pre.style.fontSize = 'inherit';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordWrap = 'break-word';
    pre.textContent = text;
    
    line.appendChild(pre);
    this.outputContainer.appendChild(line);
    this.scrollToBottom();
  }

  private async executeSimpleCommand(command: string): Promise<void> {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI not available');
      }
      
      const result = await window.electronAPI.executeCommand(command, this.currentDirectory);
      
      if (result.output) {
        const lines = result.output.split('\n');
        lines.forEach((line: string) => {
          // Always show the line, even if empty (for formatting)
          const outputType = result.success ? 'output' : 'error';
          this.addOutputLine(line, outputType);
          this.recentOutput.push(line);
          if (this.recentOutput.length > 50) {
            this.recentOutput.shift();
          }
        });
        
        // Track errors
        if (!result.success) {
          this.lastError = {
            command,
            error: result.output,
            timestamp: Date.now()
          };
          // Auto-show quick fix option
          this.showQuickFixOption();
        }
        
        // Remove trailing empty line if present
        if (lines[lines.length - 1] === '') {
          const lastLine = this.outputContainer.lastElementChild;
          if (lastLine && lastLine.textContent === '') {
            lastLine.remove();
          }
        }
      }

      if (!result.success && !result.output) {
        this.addOutputLine(`Command failed with exit code ${result.exitCode}`, 'error');
        this.lastError = {
          command,
          error: `Command failed with exit code ${result.exitCode}`,
          timestamp: Date.now()
        };
        // Auto-show quick fix option
        this.showQuickFixOption();
      }
    } catch (error: any) {
      this.addOutputLine(`Error: ${error.message}`, 'error');
      this.lastError = {
        command,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  private async handleChangeDirectory(dir: string): Promise<void> {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI not available');
      }
      
      const result = await window.electronAPI.changeDirectory(dir);
      if (result.success) {
        this.currentDirectory = result.cwd || '';
      } else {
        this.addOutputLine(`cd: ${result.error}`, 'error');
        this.lastError = {
          command: `cd ${dir}`,
          error: result.error || 'Directory change failed',
          timestamp: Date.now()
        };
        // Auto-show quick fix option
        this.showQuickFixOption();
      }
    } catch (error: any) {
      this.addOutputLine(`cd: ${error.message}`, 'error');
      this.lastError = {
        command: `cd ${dir}`,
        error: error.message,
        timestamp: Date.now()
      };
      // Auto-show quick fix option
      this.showQuickFixOption();
    }
  }

  private async updateDirectory(): Promise<void> {
    try {
      if (window.electronAPI) {
        this.currentDirectory = await window.electronAPI.getCurrentDirectory();
      }
    } catch (error) {
      console.error('Failed to get current directory:', error);
    }
  }

  private showHelp(): void {
    this.addOutputLine('Clay Terminal Help', 'info');
    this.addOutputLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'output');
    this.addOutputLine('');
    this.addOutputLine('Built-in commands:', 'info');
    this.addOutputLine('  clear, cls      - Clear the terminal screen', 'output');
    this.addOutputLine('  cd <dir>        - Change directory (use ~ for home)', 'output');
    this.addOutputLine('  pwd             - Print current working directory', 'output');
    this.addOutputLine('  help            - Show this help message', 'output');
    this.addOutputLine('');
    this.addOutputLine('Shell commands:', 'info');
    this.addOutputLine('  You can run any shell command directly.', 'output');
    this.addOutputLine('  Examples: ls, cat, grep, adb devices, npm install, etc.', 'output');
    this.addOutputLine('');
    this.addOutputLine('Navigation:', 'info');
    this.addOutputLine('  ↑/↓ Arrow keys  - Navigate command history', 'output');
    this.addOutputLine('  Ctrl+C          - Cancel current command', 'output');
    this.addOutputLine('');
    this.addOutputLine('AI Commands:', 'info');
    this.addOutputLine('  @ai <question>  - Ask the AI a question', 'output');
    this.addOutputLine('  Quick Fix       - Auto-appears when errors occur', 'output');
  }

  private addCommandLine(command: string): void {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = this.formatPrompt();
    
    const commandText = document.createElement('span');
    commandText.className = 'command-line';
    commandText.textContent = ` ${command}`;
    
    line.appendChild(prompt);
    line.appendChild(commandText);
    this.outputContainer.appendChild(line);
    
    this.scrollToBottom();
  }

  private addOutputLine(text: string, type: 'output' | 'error' | 'success' | 'info' = 'output'): void {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = text;
    this.outputContainer.appendChild(line);
    
    this.scrollToBottom();
  }

  private addPrompt(): void {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = this.formatPrompt();
    
    line.appendChild(prompt);
    this.outputContainer.appendChild(line);
    
    this.scrollToBottom();
    // Small delay to ensure DOM is updated before focusing
    setTimeout(() => this.commandInput.focus(), 10);
  }

  private clearTerminal(): void {
    this.outputContainer.innerHTML = '';
    this.printWelcomeMessage();
  }

  private scrollToBottom(): void {
    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      this.outputContainer.scrollTop = this.outputContainer.scrollHeight;
    });
  }

  private async handleAICommand(question: string): Promise<void> {
    if (!question) {
      this.addOutputLine('Usage: @ai <your question>', 'info');
      return;
    }

    this.addOutputLine('🤖 AI: Thinking...', 'info');
    
    try {
      const response = await window.aiAssistant?.askQuestion(question);
      if (response) {
        const lines = response.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.addOutputLine(`🤖 AI: ${line}`, 'info');
          }
        });
        
        // Check if response contains a command to execute
        const command = this.extractCommandFromAI(response);
        if (command) {
          this.addOutputLine(`\n⚡ Executing: ${command}`, 'info');
          setTimeout(() => {
            this.commandInput.value = command;
            this.executeCommand(command);
          }, 500);
        }
      }
    } catch (error: any) {
      this.addOutputLine(`AI Error: ${error.message}`, 'error');
    }
  }

  private extractCommandFromAI(text: string): string | null {
    // Try to extract command from code blocks
    const codeBlockMatch = text.match(/```[\w]*\n([^`]+)```/);
    if (codeBlockMatch) {
      const code = codeBlockMatch[1].trim().split('\n')[0].trim();
      if (code && !code.startsWith('$') && !code.startsWith('#') && code.length < 200) {
        return code;
      }
    }

    // Try inline code
    const inlineCodeMatch = text.match(/`([^`]+)`/);
    if (inlineCodeMatch) {
      const code = inlineCodeMatch[1].trim();
      if (code && code.length < 200 && !code.includes('\n')) {
        return code;
      }
    }

    return null;
  }

  private showQuickFixOption(): void {
    if (!this.lastError) return;

    // Remove any existing quick fix button
    const existingFix = this.outputContainer.querySelector('.inline-quick-fix');
    if (existingFix) {
      existingFix.remove();
    }

    const fixContainer = document.createElement('div');
    fixContainer.className = 'terminal-line inline-quick-fix';
    
    const fixText = document.createElement('span');
    fixText.className = 'quick-fix-text';
    fixText.textContent = '🔧 AI Quick Fix available - Analyzing error...';
    
    fixContainer.appendChild(fixText);
    this.outputContainer.appendChild(fixContainer);
    this.scrollToBottom();

    // Auto-trigger quick fix
    setTimeout(() => {
      this.performQuickFix(true);
    }, 500);
  }

  private async performQuickFix(autoExecute: boolean = false): Promise<void> {
    if (!this.lastError || !window.aiAssistant) {
      return;
    }

    const fixContainer = this.outputContainer.querySelector('.inline-quick-fix');
    if (fixContainer) {
      const fixText = fixContainer.querySelector('.quick-fix-text');
      if (fixText) {
        fixText.textContent = '🔧 AI: Diagnosing error and preparing fix...';
      }
    }

    try {
      const context = `Command that failed: ${this.lastError.command}\nError output: ${this.lastError.error}\nCurrent directory: ${this.currentDirectory}\nRecent output: ${this.recentOutput.slice(-10).join('\n')}`;
      
      const prompt = `I got this error in my terminal:\n\n${context}\n\nPlease:\n1. Diagnose what went wrong in one sentence\n2. Provide the exact command to fix it\n3. Format the fix command in a code block like \`\`\`bash\nfix-command\n\`\`\``;
      
      const response = await window.aiAssistant.askQuestion(prompt);
      
      if (fixContainer) {
        const fixText = fixContainer.querySelector('.quick-fix-text');
        if (fixText) {
          // Show diagnosis
          const diagnosis = response.split('\n').slice(0, 2).join(' ').substring(0, 150);
          fixText.textContent = `🔧 AI Diagnosis: ${diagnosis}`;
        }
      }

      // Extract and execute the fix command
      const fixCommand = this.extractCommandFromAI(response);
      if (fixCommand && autoExecute) {
        setTimeout(() => {
          this.addOutputLine(`\n⚡ Auto-executing fix: ${fixCommand}`, 'info');
          this.commandInput.value = fixCommand;
          this.executeCommand(fixCommand);
        }, 1000);
      } else if (fixCommand) {
        // Show fix button if not auto-executing
        if (fixContainer) {
          const fixBtn = document.createElement('button');
          fixBtn.className = 'inline-fix-btn';
          fixBtn.textContent = `⚡ Execute Fix: ${fixCommand}`;
          fixBtn.onclick = () => {
            this.commandInput.value = fixCommand;
            this.executeCommand(fixCommand);
          };
          fixContainer.appendChild(fixBtn);
        }
      }
    } catch (error: any) {
      if (fixContainer) {
        const fixText = fixContainer.querySelector('.quick-fix-text');
        if (fixText) {
          fixText.textContent = `🔧 Quick Fix Error: ${error.message}`;
        }
      }
    }
  }
}

// Simple AI Assistant Class - Just provides askQuestion method
class SimpleAIAssistant {
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private model: string = 'codestral-2501'; // Best for code

  private readonly API_BASE_URL = 'https://api.llm7.io/v1';
  private readonly API_KEY = 'unused'; // Free tier, can upgrade at https://token.llm7.io/

  constructor() {
    // System prompt for coding and bash assistance
    this.conversationHistory.push({
      role: 'system',
      content: 'You are a helpful AI assistant specialized in coding, bash commands, and terminal operations. Provide clear, concise answers with code examples when relevant. Format commands in code blocks.'
    });
  }

  public async askQuestion(question: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: question });

    try {
      const messages = [
        ...this.conversationHistory.filter(msg => msg.role === 'system'),
        ...this.conversationHistory.filter(msg => msg.role !== 'system').slice(-10), // Keep last 10 messages
      ];

      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices[0]?.message?.content || 'No response generated';
      
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });
      
      // Keep conversation history manageable
      if (this.conversationHistory.length > 30) {
        this.conversationHistory = [
          this.conversationHistory[0], // Keep system message
          ...this.conversationHistory.slice(-20) // Keep last 20 messages
        ];
      }
      
      return assistantResponse;
    } catch (error: any) {
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  }
}

// Initialize terminal and AI assistant when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.clayTerminal = new ClayTerminal();
  window.aiAssistant = new SimpleAIAssistant();
});
