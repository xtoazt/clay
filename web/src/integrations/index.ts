/**
 * Integration Hub
 * Centralized access to all Clay integrations
 */

import { clayupIntegration, BackendInterface } from './clayup';
import { clayLinuxIntegration } from './claylinux';
import { clayEmulatorUtils, ClayEmulator } from './clayemu';
import { clayVMIntegration } from './clayvm';
import { clayRecoveryIntegration } from './clayrecovery';
import { clayPodIntegration } from './claypod';
import { clayPuppeteerIntegration } from './claypuppeteer';

export type { BackendInterface };

export {
  clayupIntegration,
  clayLinuxIntegration,
  clayEmulatorUtils,
  ClayEmulator,
  clayVMIntegration,
  clayRecoveryIntegration,
  clayPodIntegration,
  clayPuppeteerIntegration,
};

/**
 * Integration Manager
 * Manages all Clay integrations and provides unified interface
 */
export class IntegrationManager {
  private integrations: Map<string, any> = new Map();

  constructor() {
    this.registerIntegration('clayup', clayupIntegration);
    this.registerIntegration('claylinux', clayLinuxIntegration);
    this.registerIntegration('clayvm', clayVMIntegration);
    this.registerIntegration('clayrecovery', clayRecoveryIntegration);
    this.registerIntegration('claypod', clayPodIntegration);
    this.registerIntegration('claypuppeteer', clayPuppeteerIntegration);
  }

  /**
   * Register an integration
   */
  registerIntegration(name: string, integration: any): void {
    this.integrations.set(name, integration);
  }

  /**
   * Get an integration
   */
  getIntegration(name: string): any {
    return this.integrations.get(name);
  }

  /**
   * Get all available integrations
   */
  getAvailableIntegrations(): string[] {
    return Array.from(this.integrations.keys());
  }

  /**
   * Check integration status
   */
  async checkAllStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [name, integration] of this.integrations.entries()) {
      if (integration.getStatus) {
        status[name] = integration.getStatus();
      } else if (integration.checkAvailability) {
        status[name] = {
          available: await integration.checkAvailability(),
        };
      }
    }

    // Check Clay Emulator separately
    status.clayemu = {
      available: clayEmulatorUtils.isAvailable(),
    };

    return status;
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();

