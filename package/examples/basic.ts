/**
 * Clay Backend API Example - TypeScript Version
 * This demonstrates the pure backend API - no UI dependencies!
 * 
 * To use this example:
 * 1. Build the package: `npm run build:package`
 * 2. Import this in your TypeScript project
 * 3. Or compile to JavaScript and use in a browser
 */

import { createClayBackend } from '../clay-backend';

let backend: any = null;

/**
 * Initialize the backend
 */
export async function initBackend(): Promise<void> {
  try {
    backend = await createClayBackend({
      bridgeUrl: 'ws://127.0.0.1:8765/ws', // Optional: for real system access
      enableHistory: true
    });
    
    console.log('✓ Backend initialized');
    
    // Listen to output
    backend.onOutput((data: string) => {
      console.log(data);
    });
    
    // Listen to errors
    backend.onError((error: string) => {
      console.error(`[ERROR] ${error}`);
    });
    
    // Listen to status changes
    backend.onStatusChange((status: any) => {
      console.log(`[STATUS] Backend: ${status.backend}`);
    });
    
    // Get system info
    const info = await backend.getSystemInfo();
    if (info) {
      console.log(`Platform: ${info.platform}`);
      console.log(`Shell: ${info.shell}`);
      console.log(`CWD: ${info.cwd}`);
    }
  } catch (error: any) {
    console.error(`[ERROR] Failed to initialize: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a command
 */
export async function executeCommand(command: string): Promise<void> {
  if (!command || !backend) {
    console.warn('Backend not initialized or command is empty');
    return;
  }
  
  console.log(`$ ${command}`);
  
  try {
    const result = await backend.executeCommand(command);
    if (result.exitCode === 0) {
      console.log(result.output);
    } else {
      console.error(`[ERROR] Exit code: ${result.exitCode}`);
      if (result.error) {
        console.error(result.error);
      }
    }
  } catch (error: any) {
    console.error(`[ERROR] ${error.message}`);
  }
}

// Example usage:
// initBackend().then(() => {
//   executeCommand('ls');
//   executeCommand('pwd');
// });

