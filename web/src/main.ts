import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { CanvasAddon } from 'xterm-addon-canvas';
import { WebVMBackend } from './webvm';

class ClayWebTerminal {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private webvm: WebVMBackend;
  private isConnected: boolean = false;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentLine: string = '';
  private aiAssistant: SimpleAIAssistant;
  private currentDirectory: string = '/home/user';

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
      fontSize: 12,
      fontFamily: 'Menlo, "DejaVu Sans Mono", "Lucida Console", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      lineHeight: 1.5
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());
    this.terminal.loadAddon(new CanvasAddon());

    this.aiAssistant = new SimpleAIAssistant();
    this.webvm = new WebVMBackend();

    this.initializeTerminal();
    this.setupWebVM();
  }

  private initializeTerminal(): void {
    const terminalElement = document.getElementById('terminal');
    if (!terminalElement) {
      throw new Error('Terminal element not found');
    }

    this.terminal.open(terminalElement);
    this.fitAddon.fit();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.fitAddon.fit();
    });

    // Handle keyboard input and commands
    this.terminal.onData((data: string) => {
      this.handleLocalCommand(data);
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

  private async setupWebVM(): Promise<void> {
    try {
      this.terminal.write('\r\n\x1b[33m[INFO]\x1b[0m Initializing WebVM...\r\n');
      this.terminal.write('\x1b[33m[INFO]\x1b[0m Booting Linux environment...\r\n');
      
      // Initialize WebVM
      await this.webvm.initialize();
      
      // Create Socket.io server inside WebVM
      this.terminal.write('\x1b[33m[INFO]\x1b[0m Starting Socket.io server...\r\n');
      await this.webvm.createSocketServer();
      
      this.terminal.write('\x1b[32m[SUCCESS]\x1b[0m WebVM ready!\r\n');
      this.terminal.write('\r\n');
      
      this.isConnected = true;
      this.writePrompt();
      
      this.hideLoading();
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[ERROR]\x1b[0m Failed to initialize: ${error.message}\r\n`);
      this.terminal.write('\r\nUsing fallback terminal mode...\r\n');
      this.isConnected = true;
      this.writePrompt();
      this.hideLoading();
    }
  }

  private handleLocalCommand(data: string): void {
    // Handle special keys
    if (data === '\r') {
      // Enter pressed
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
      await this.handleAICommand(question);
      this.writePrompt();
      return;
    }

    // Execute in WebVM
    if (this.isConnected && this.webvm) {
      await this.executeInWebVM(command);
    } else {
      this.terminal.write(`\x1b[31m[ERROR]\x1b[0m WebVM not connected\r\n`);
      this.writePrompt();
    }
  }

  private async executeInWebVM(command: string): Promise<void> {
    try {
      // Handle cd command separately
      if (command.startsWith('cd ')) {
        const dir = command.substring(3).trim();
        if (dir === '~' || dir === '') {
          this.currentDirectory = '/home/user';
        } else if (dir.startsWith('/')) {
          this.currentDirectory = dir;
        } else {
          this.currentDirectory = `${this.currentDirectory}/${dir}`;
        }
        this.writePrompt();
        return;
      }

      // Execute command in WebVM
      const result = await this.webvm.executeCommand(command);
      
      // Display output
      this.terminal.write(result.output);
      
      if (result.exitCode !== 0) {
        // Show error indicator
      }
      
      this.writePrompt();
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[ERROR]\x1b[0m ${error.message}\r\n`);
      this.writePrompt();
    }
  }

  private async handleAICommand(question: string): Promise<void> {
    this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Thinking...\r\n`);
    
    try {
      const response = await this.aiAssistant.askQuestion(question);
      const lines = response.split('\n');
      
      lines.forEach(line => {
        if (line.trim()) {
          this.terminal.write(`\x1b[36m[AI]\x1b[0m ${line}\r\n`);
        }
      });
      
      // Extract and execute commands from AI response
      const command = this.extractCommand(response);
      if (command) {
        this.terminal.write(`\r\n\x1b[33m[Executing]\x1b[0m ${command}\r\n`);
        await this.executeCommand(command);
        return;
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
    }
  }

  private extractCommand(text: string): string | null {
    const codeBlockMatch = text.match(/```[\w]*\n([^`]+)```/);
    if (codeBlockMatch) {
      const code = codeBlockMatch[1].trim().split('\n')[0].trim();
      if (code && !code.startsWith('$') && code.length < 200) {
        return code;
      }
    }
    return null;
  }

  private writePrompt(): void {
    const shortPath = this.currentDirectory.replace('/home/user', '~');
    this.terminal.write(`\x1b[35muser@webvm\x1b[0m:\x1b[34m${shortPath}\x1b[0m$ `);
  }

  private printWelcomeMessage(): void {
    this.terminal.write(`\x1b[32mClay Terminal\x1b[0m - The best terminal experience\r\n`);
    this.terminal.write(`Type \x1b[33m@ai <question>\x1b[0m to ask the AI assistant\r\n`);
    this.terminal.write(`Type \x1b[33mhelp\x1b[0m for available commands\r\n`);
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

  constructor() {
    this.conversationHistory.push({
      role: 'system',
      content: 'You are a helpful AI assistant specialized in coding, bash commands, and terminal operations.'
    });
  }

  public async askQuestion(question: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: question });

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
          model: 'codestral-2501',
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ClayWebTerminal();
  
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

