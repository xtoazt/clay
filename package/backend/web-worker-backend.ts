/**
 * Web Worker Backend - Browser-only terminal emulation
 * 
 * Note: This is a stub implementation. For full browser-only functionality,
 * users should either:
 * 1. Use the BridgeBackend with a local bridge server
 * 2. Provide their own worker implementation
 * 3. Use a simple command execution backend
 */

import type { TerminalBackend, OutputCallback, ErrorCallback } from '../types';

export class WebWorkerBackend implements TerminalBackend {
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private onOutputCallback: ((data: string) => void) | null = null;
  private onExitCallback: ((code: number, signal: number) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  async connect(): Promise<void> {
    // Stub implementation - for package users, recommend using BridgeBackend
    // or providing custom worker implementation
    this.isConnected = true;
    this.sessionId = `session_${Date.now()}`;
    
    if (this.onOutputCallback) {
      this.onOutputCallback('\x1b[33m[INFO]\x1b[0m Web Worker backend (stub mode)\r\n');
      this.onOutputCallback('\x1b[33m[INFO]\x1b[0m For full functionality, use BridgeBackend or provide worker implementation\r\n');
    }
    
    return Promise.resolve();
  }

  disconnect(): void {
    this.isConnected = false;
    this.sessionId = null;
  }

  sendInput(data: string): void {
    // Stub - echo back for basic functionality
    if (this.onOutputCallback && data.trim()) {
      const command = data.trim();
      if (command.endsWith('\r\n') || command.endsWith('\n')) {
        const cmd = command.replace(/\r?\n$/, '');
        if (cmd) {
          this.onOutputCallback(`\r\n$ ${cmd}\r\n`);
          
          // Basic command handling
          if (cmd === 'help') {
            this.onOutputCallback('Available commands: help, echo, pwd\r\n');
          } else if (cmd.startsWith('echo ')) {
            this.onOutputCallback(cmd.substring(5) + '\r\n');
          } else if (cmd === 'pwd') {
            this.onOutputCallback('/home/user\r\n');
          } else {
            this.onOutputCallback(`\x1b[33m[Note]\x1b[0m For full command support, use BridgeBackend with bridge server\r\n`);
          }
        }
      }
    }
  }

  resize(cols: number, rows: number): void {
    // Stub - no-op for web worker
  }

  onOutput(callback: OutputCallback): void {
    this.onOutputCallback = callback;
  }

  onExit(callback: (code: number, signal: number) => void): void {
    this.onExitCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  getConnected(): boolean {
    return this.isConnected;
  }

  async executeCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    // Basic command execution stub
    if (command.trim() === 'help') {
      return { output: 'Available commands: help, echo, pwd\n', exitCode: 0 };
    } else if (command.startsWith('echo ')) {
      return { output: command.substring(5) + '\n', exitCode: 0 };
    } else if (command.trim() === 'pwd') {
      return { output: '/home/user\n', exitCode: 0 };
    }
    return { output: 'Command not available in stub mode. Use BridgeBackend for full support.\n', exitCode: 1 };
  }

  async getSystemInfo(): Promise<any> {
    return {
      platform: 'web',
      shell: '/bin/bash',
      cwd: '/home/user',
      homeDir: '/home/user'
    };
  }
}

