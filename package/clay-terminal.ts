/**
 * Clay Terminal - A beautiful, modern terminal for the web
 * Perfect for ChromeOS users without terminal access
 * 
 * @packageDocumentation
 */

export { ClayTerminal } from './core/terminal';
export type { ClayTerminalConfig, ClayTerminalOptions } from './types';
export { BridgeBackend } from './backend/bridge-backend';
export { WebWorkerBackend } from './backend/web-worker-backend';
export { SessionEncoder } from './utils/session-encoder';

// Re-export types
export type {
  TerminalBackend,
  AIAssistantConfig,
  StatusCallback,
  OutputCallback,
  ErrorCallback,
  TerminalTheme
} from './types';

import { ClayTerminal } from './core/terminal';
import type { ClayTerminalConfig } from './types';

/**
 * Create and initialize a new Clay Terminal instance
 * 
 * @example
 * ```typescript
 * import { createClayTerminal } from 'clay-util';
 * 
 * const terminal = await createClayTerminal({
 *   container: document.getElementById('terminal'),
 *   bridgeUrl: 'ws://127.0.0.1:8765/ws'
 * });
 * ```
 */
export async function createClayTerminal(config: ClayTerminalConfig): Promise<ClayTerminal> {
  const terminal = new ClayTerminal(config);
  await terminal.initialize();
  return terminal;
}

/**
 * Default export for convenience
 */
export default ClayTerminal;

