import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  executeCommand: (command: string, cwd?: string) =>
    ipcRenderer.invoke('execute-command', command, cwd),
  executeCommandStream: (command: string, cwd?: string) =>
    ipcRenderer.invoke('execute-command-stream', command, cwd),
  createPtySession: (cwd?: string, cols?: number, rows?: number) =>
    ipcRenderer.invoke('create-pty-session', cwd, cols, rows),
  getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
  changeDirectory: (dir: string) => ipcRenderer.invoke('change-directory', dir),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  hasPtySupport: () => ipcRenderer.invoke('has-pty-support'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  onTerminalResize: (callback: (size: { cols: number; rows: number }) => void) => {
    ipcRenderer.on('terminal-resize', (event, size) => callback(size));
  },
});

