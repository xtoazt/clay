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
  private lastError: { command: string; output: string; timestamp: number } | null = null;
  private aiControlEnabled: boolean = false;
  private aiExecuting: boolean = false;

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

    // Expose to window for UI access
    (window as any).clayTerminal = this;

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
        this.writePrompt();
        return;
      }
      
      await this.handleAICommand(question);
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
    this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Auto-fixing error...\r\n`);
    
    try {
      const fixCommand = await this.aiAssistant.quickFix(this.lastError.command, this.lastError.output);
      if (fixCommand) {
        this.terminal.write(`\x1b[33m[AI]\x1b[0m Executing fix: ${fixCommand}\r\n`);
        await this.executeInWebVM(fixCommand);
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
    } finally {
      this.aiExecuting = false;
    }
  }

  public async manualQuickFix(): Promise<void> {
    if (!this.lastError) {
      this.terminal.write(`\x1b[33m[INFO]\x1b[0m No error to fix\r\n`);
      this.writePrompt();
      return;
    }

    this.aiExecuting = true;
    this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Diagnosing error...\r\n`);
    
    try {
      const fixCommand = await this.aiAssistant.quickFix(this.lastError.command, this.lastError.output);
      if (fixCommand) {
        this.terminal.write(`\x1b[33m[AI]\x1b[0m Executing fix: ${fixCommand}\r\n`);
        await this.executeInWebVM(fixCommand);
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
      this.writePrompt();
    } finally {
      this.aiExecuting = false;
    }
  }

  private async handleAICommand(question: string): Promise<void> {
    this.aiExecuting = true;
    this.terminal.write(`\r\n\x1b[36m[AI]\x1b[0m Thinking...\r\n`);
    
    try {
      const response = await this.aiAssistant.askQuestion(question, this.currentDirectory, this.commandHistory);
      
      // Parse and display markdown response
      this.displayMarkdownResponse(response);
      
      // Extract and execute commands from AI response
      const commands = this.extractCommands(response);
      if (commands.length > 0 && this.aiControlEnabled) {
        for (const command of commands) {
          this.terminal.write(`\r\n\x1b[33m[AI Executing]\x1b[0m ${command}\r\n`);
          await this.executeCommand(command);
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between commands
        }
      } else if (commands.length > 0) {
        // Show commands but don't execute (user control)
        this.terminal.write(`\r\n\x1b[33m[AI Suggested]\x1b[0m Commands found:\r\n`);
        commands.forEach(cmd => {
          this.terminal.write(`  ${cmd}\r\n`);
        });
        this.terminal.write(`\x1b[33m[Tip]\x1b[0m Type "@ai enable" to let AI auto-execute commands\r\n`);
      }
    } catch (error: any) {
      this.terminal.write(`\x1b[31m[AI ERROR]\x1b[0m ${error.message}\r\n`);
    } finally {
      this.aiExecuting = false;
      this.writePrompt();
    }
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
    
    // Extract from code blocks
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
    
    // Extract inline code that looks like commands
    const inlineCodeRegex = /`([^`]+)`/g;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      const cmd = match[1].trim();
      if (cmd && cmd.length < 200 && !cmd.includes('\n') && /^[a-zA-Z0-9_\-./]/.test(cmd)) {
        commands.push(cmd);
      }
    }
    
    return commands;
  }

  public writePrompt(): void {
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const terminal = new ClayWebTerminal();
  
  // Model selector UI
  const modelBtn = document.getElementById('model-btn');
  const modelSelector = document.getElementById('model-selector');
  const closeModelSelector = document.getElementById('close-model-selector');
  const modelList = document.getElementById('model-list');
  const quickFixBtn = document.getElementById('quick-fix-btn');
  
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
    
    const models = (window as any).clayTerminal.aiAssistant.getAvailableModels();
    const currentModel = (window as any).clayTerminal.aiAssistant.getCurrentModel();
    
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
        (window as any).clayTerminal.aiAssistant.setModel(model.id);
        modelSelector!.style.display = 'none';
        // Show confirmation
        (window as any).clayTerminal.terminal.write(`\r\n\x1b[32m[Model]\x1b[0m Switched to ${model.name}\r\n`);
        (window as any).clayTerminal.writePrompt();
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

