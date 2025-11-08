/**
 * Leaf Recovery Integration (Azalea Recovery & Modding Tools)
 * ChromeOS Recovery and Modding Tools
 * 
 * Leaf Recovery provides access to ChromeOS recovery and modding tools,
 * allowing you to check device information, firmware details, recovery mode
 * status, and partition information. Essential for ChromeOS developers and
 * power users who need to modify or troubleshoot their devices.
 * 
 * Based on: https://github.com/MercuryWorkshop/RecoMod
 */

import type { BackendInterface } from './leafup';

export interface LeafRecoveryConfig {
  device?: string;
  recovery?: boolean;
  modding?: boolean;
}

export class LeafRecoveryIntegration {
  private isChromeOS: boolean = false;
  private isAvailable: boolean = false;
  private backend: BackendInterface | null = null;

  constructor(backend?: BackendInterface) {
    this.backend = backend || null;
    this.detectEnvironment();
  }

  /**
   * Set backend instance
   */
  setBackend(backend: BackendInterface): void {
    this.backend = backend;
    this.checkAvailability();
  }

  /**
   * Detect ChromeOS environment
   */
  async detectEnvironment(): Promise<boolean> {
    if (!this.backend) {
      return false;
    }

    try {
      const result = await this.executeCommand('test -f /etc/lsb-release && grep -q CHROMEOS /etc/lsb-release && echo "1" || echo "0"');
      this.isChromeOS = result.output.trim() === '1';
      return this.isChromeOS;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if recovery tools are available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend || !this.isChromeOS) {
      this.isAvailable = false;
      return false;
    }

    try {
      // Check for crossystem (ChromeOS system info tool)
      const result = await this.executeCommand('which crossystem');
      this.isAvailable = result.exitCode === 0;
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<{ success: boolean; info?: any; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Recovery is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('crossystem');
      return {
        success: result.exitCode === 0,
        output: result.output || 'Device information retrieved'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get device info' };
    }
  }

  /**
   * Check recovery mode
   */
  async checkRecoveryMode(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Recovery is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('crossystem recovery_reason');
      return {
        success: result.exitCode === 0,
        output: result.output || 'Recovery mode check completed'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to check recovery mode' };
    }
  }

  /**
   * Get firmware information
   */
  async getFirmwareInfo(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Recovery is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('futility show');
      return {
        success: result.exitCode === 0,
        output: result.output || 'Firmware information retrieved'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get firmware info' };
    }
  }

  /**
   * Check developer mode
   */
  async checkDeveloperMode(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Recovery is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('crossystem dev_boot_usb dev_boot_signed_only');
      return {
        success: result.exitCode === 0,
        output: result.output || 'Developer mode check completed'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to check developer mode' };
    }
  }

  /**
   * Get partition information
   */
  async getPartitionInfo(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Recovery is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('cgpt show /dev/sda');
      return {
        success: result.exitCode === 0,
        output: result.output || 'Partition information retrieved'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get partition info' };
    }
  }

  /**
   * Execute command via backend
   */
  private async executeCommand(command: string): Promise<{ exitCode: number; output: string }> {
    if (!this.backend) {
      return { exitCode: 1, output: 'Backend not available' };
    }
    return await this.backend.executeCommand(command);
  }

  getStatus(): { available: boolean; isChromeOS: boolean } {
    return {
      available: this.isAvailable,
      isChromeOS: this.isChromeOS
    };
  }
}

// Export singleton instance
export const leafRecoveryIntegration = new LeafRecoveryIntegration();

