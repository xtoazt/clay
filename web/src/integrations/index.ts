/**
 * Integration Hub
 * Centralized access to all Azalea integrations
 * 
 * All integrations use the "leaf" prefix for shorter command names.
 * The main brand is "Azalea" but integrations are accessed via "leaf" commands.
 */

import { leafupIntegration, BackendInterface } from './leafup';
import { leafLinuxIntegration } from './leaflinux';
import { leafEmulatorUtils, LeafEmulator } from './leafemu';
import { leafVMIntegration } from './leafvm';
import { leafRecoveryIntegration } from './leafrecovery';
import { leafPodIntegration } from './leafpod';
import { leafPuppeteerIntegration } from './leafpuppeteer';

export type { BackendInterface };

export {
  leafupIntegration,
  leafLinuxIntegration,
  leafEmulatorUtils,
  LeafEmulator,
  leafVMIntegration,
  leafRecoveryIntegration,
  leafPodIntegration,
  leafPuppeteerIntegration,
};

/**
 * Integration Manager
 * Manages all Azalea integrations and provides unified interface
 */
export class IntegrationManager {
  private integrations: Map<string, any> = new Map();

  constructor() {
    this.registerIntegration('leafup', leafupIntegration);
    this.registerIntegration('leaflinux', leafLinuxIntegration);
    this.registerIntegration('leafvm', leafVMIntegration);
    this.registerIntegration('leafrecovery', leafRecoveryIntegration);
    this.registerIntegration('leafpod', leafPodIntegration);
    this.registerIntegration('leafpuppeteer', leafPuppeteerIntegration);
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

    // Check Leaf Emulator separately
    status.leafemu = {
      available: leafEmulatorUtils.isAvailable(),
    };

    return status;
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();
