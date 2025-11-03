/**
 * Bridge Backend - Connects to local Node.js bridge server for real system access
 */

import type { TerminalBackend, OutputCallback, ErrorCallback } from '../types';

export class BridgeBackend implements TerminalBackend {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private onOutputCallback: ((data: string) => void) | null = null;
  private onExitCallback: ((code: number, signal: number) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private bridgeUrl: string;

  constructor(bridgeUrl: string = 'ws://127.0.0.1:8765/ws') {
    this.bridgeUrl = bridgeUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.bridgeUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                this.sessionId = data.sessionId;
                if (this.onOutputCallback) {
                  this.onOutputCallback(`\x1b[32m[Connected]\x1b[0m Bridge: ${data.shell}\r\n`);
                }
                resolve();
                break;
                
              case 'output':
                if (this.onOutputCallback && data.sessionId === this.sessionId) {
                  this.onOutputCallback(data.data);
                }
                break;
                
              case 'exit':
                if (this.onExitCallback && data.sessionId === this.sessionId) {
                  this.onExitCallback(data.code || 0, data.signal || 0);
                }
                break;
                
              case 'error':
                if (this.onErrorCallback) {
                  this.onErrorCallback(data.message);
                }
                reject(new Error(data.message));
                break;
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          this.isConnected = false;
          if (this.onErrorCallback) {
            this.onErrorCallback('Connection error');
          }
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  sendInput(data: string): void {
    if (this.ws && this.isConnected && this.sessionId) {
      this.ws.send(JSON.stringify({
        type: 'input',
        sessionId: this.sessionId,
        data: data
      }));
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ws && this.isConnected && this.sessionId) {
      this.ws.send(JSON.stringify({
        type: 'resize',
        sessionId: this.sessionId,
        cols: cols,
        rows: rows
      }));
    }
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

  getSessionId(): string | null {
    return this.sessionId;
  }

  async executeCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command, cwd })
      });

      const data = await response.json();
      return {
        output: data.output || '',
        exitCode: data.exitCode || (data.success ? 0 : 1)
      };
    } catch (error: any) {
      return {
        output: `Error: ${error.message}`,
        exitCode: 1
      };
    }
  }

  async getSystemInfo(): Promise<any> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/info');
      return await response.json();
    } catch (error: any) {
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/health');
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}

