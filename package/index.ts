/**
 * Clay Terminal Package Entry Point
 * Re-exports all public APIs
 */

export { ClayTerminal, createClayTerminal } from './clay-terminal';
export type { ClayTerminalConfig, ClayTerminalOptions, TerminalTheme, AIAssistantConfig, TerminalBackend } from './types';
export { BridgeBackend } from './backend/bridge-backend';
export { WebWorkerBackend } from './backend/web-worker-backend';
export { SessionEncoder } from './utils/session-encoder';

