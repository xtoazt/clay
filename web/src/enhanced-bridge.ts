// Enhanced Bridge System
// Provides multiple bridge options with automatic fallback
// Ensures the terminal always works, regardless of environment

import { BridgeBackend } from './bridge-backend';
import { WebWorkerBackendWrapper } from './backend-worker-wrapper';
import { ErrorHandler } from './utils/error-handler';
import { retryWithBackoff, withTimeout } from './utils/error-handler';
import { CircuitBreaker } from './utils/resilience';

export type BridgeType = 'browserpod' | 'external' | 'webvm' | 'none';

export interface BridgeConfig {
  preferredType?: BridgeType;
  enableAutoFallback?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

/**
 * Enhanced Bridge Manager
 * Manages multiple bridge types with automatic fallback
 */
export class EnhancedBridge {
  private config: Required<BridgeConfig>;
  private currentBridge: BridgeBackend | WebWorkerBackendWrapper | null = null;
  private bridgeType: BridgeType = 'none';
  private circuitBreaker: CircuitBreaker;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: BridgeConfig = {}) {
    this.config = {
      preferredType: config.preferredType || 'external',
      enableAutoFallback: config.enableAutoFallback !== false,
      retryAttempts: config.retryAttempts || 3,
      timeout: config.timeout || 10000,
      ...config
    };
    
    this.circuitBreaker = new CircuitBreaker(5, 60000, 30000);
  }

  /**
   * Initialize and connect to the best available bridge
   */
  async initialize(): Promise<BridgeBackend | WebWorkerBackendWrapper> {
    const bridgeTypes: BridgeType[] = [
      this.config.preferredType,
      'external',
      'webvm'
    ].filter((t, i, arr) => arr.indexOf(t) === i) as BridgeType[];

    for (const type of bridgeTypes) {
      try {
        const bridge = await this.tryBridgeType(type);
        if (bridge) {
          this.currentBridge = bridge;
          this.bridgeType = type;
          console.log(`[EnhancedBridge] Connected via ${type} bridge`);
          
          // Start health monitoring
          this.startHealthMonitoring();
          
          return bridge;
        }
      } catch (error) {
        ErrorHandler.handle(error, {
          component: 'EnhancedBridge',
          operation: `initialize-${type}`,
          details: { type }
        });
        continue; // Try next bridge type
      }
    }

    // If all bridges fail, return WebVM as last resort
    console.warn('[EnhancedBridge] All bridges failed, using WebVM fallback');
    const webvm = new WebWorkerBackendWrapper();
    await webvm.connect();
    this.currentBridge = webvm;
    this.bridgeType = 'webvm';
    return webvm;
  }

  /**
   * Try to connect to a specific bridge type
   */
  private async tryBridgeType(type: BridgeType): Promise<BridgeBackend | WebWorkerBackendWrapper | null> {
    return await this.circuitBreaker.execute(async () => {
      return await withTimeout(
        this.connectToBridgeType(type),
        this.config.timeout,
        { component: 'EnhancedBridge', operation: `tryBridgeType-${type}` }
      );
    });
  }

  /**
   * Connect to a specific bridge type
   */
  private async connectToBridgeType(type: BridgeType): Promise<BridgeBackend | WebWorkerBackendWrapper | null> {
    switch (type) {
      case 'external':
        return await this.connectExternalBridge();
      
      case 'webvm':
        return await this.connectWebVMBridge();
      
      case 'browserpod':
        // BrowserPod not available, skip
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Connect to external bridge server
   */
  private async connectExternalBridge(): Promise<BridgeBackend | null> {
    try {
      const bridge = new BridgeBackend();
      // Quick health check with shorter timeout for non-ChromeOS
      const isHealthy = await retryWithBackoff(
        () => bridge.healthCheck(),
        this.config.retryAttempts,
        500, // Faster retry delay
        { component: 'EnhancedBridge', operation: 'connectExternalBridge' }
      );
      
      if (isHealthy) {
        // Bridge is healthy, now actually connect the WebSocket
        try {
          await bridge.connect();
          return bridge;
        } catch (connectError) {
          console.log('[EnhancedBridge] Bridge health check passed but connection failed:', connectError instanceof Error ? connectError.message : String(connectError));
          return null;
        }
      }
    } catch (error) {
      // External bridge not available - this is expected on most devices
      console.log('[EnhancedBridge] External bridge not available:', error instanceof Error ? error.message : String(error));
    }
    
    return null;
  }

  /**
   * Connect to WebVM bridge
   */
  private async connectWebVMBridge(): Promise<WebWorkerBackendWrapper> {
    const webvm = new WebWorkerBackendWrapper();
    await retryWithBackoff(
      () => webvm.connect(),
      this.config.retryAttempts,
      500,
      { component: 'EnhancedBridge', operation: 'connectWebVMBridge' }
    );
    return webvm;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.currentBridge) {
        return;
      }

      try {
        // Check if bridge is still healthy
        if (this.bridgeType === 'external' && this.currentBridge instanceof BridgeBackend) {
          const isHealthy = await this.currentBridge.healthCheck();
          if (!isHealthy && this.config.enableAutoFallback) {
            console.warn('[EnhancedBridge] External bridge unhealthy, attempting fallback...');
            await this.reconnect();
          }
        }
      } catch (error) {
        ErrorHandler.handle(error, {
          component: 'EnhancedBridge',
          operation: 'healthCheck'
        });
        
        if (this.config.enableAutoFallback) {
          await this.reconnect();
        }
      }
    }, 5000);
  }

  /**
   * Reconnect with fallback
   */
  async reconnect(): Promise<void> {
    console.log('[EnhancedBridge] Reconnecting...');
    
    // Stop current bridge
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Try to reconnect
    try {
      await this.initialize();
    } catch (error) {
      ErrorHandler.handle(error, {
        component: 'EnhancedBridge',
        operation: 'reconnect'
      });
    }
  }

  /**
   * Get current bridge
   */
  getBridge(): BridgeBackend | WebWorkerBackendWrapper | null {
    return this.currentBridge;
  }

  /**
   * Get current bridge type
   */
  getBridgeType(): BridgeType {
    return this.bridgeType;
  }

  /**
   * Check if bridge is connected
   */
  isConnected(): boolean {
    if (!this.currentBridge) {
      return false;
    }
    
    if (this.currentBridge instanceof BridgeBackend) {
      return this.currentBridge.getConnected();
    }
    
    if (this.currentBridge instanceof WebWorkerBackendWrapper) {
      return this.currentBridge.getConnected();
    }
    
    return false;
  }

  /**
   * Stop bridge
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.currentBridge = null;
    this.bridgeType = 'none';
    this.circuitBreaker.reset();
  }
}

// Global instance
let enhancedBridgeInstance: EnhancedBridge | null = null;

/**
 * Get or create enhanced bridge instance
 */
export function getEnhancedBridge(config?: BridgeConfig): EnhancedBridge {
  if (!enhancedBridgeInstance) {
    enhancedBridgeInstance = new EnhancedBridge(config);
  }
  return enhancedBridgeInstance;
}

