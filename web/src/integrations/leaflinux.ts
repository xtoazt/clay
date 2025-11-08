/**
 * Leaf Linux Integration (Azalea Container Management)
 * Rapid setup scripts for ChromeOS Linux container
 * 
 * Leaf Linux provides tools to quickly set up and manage the ChromeOS Linux
 * container (Crostini). It automates the installation of development tools,
 * desktop environments, and common packages for a productive Linux environment.
 * 
 * Based on: https://github.com/francis-chris5/Chrostini-Initializers
 */

import type { BackendInterface } from './leafup';

export interface LeafLinuxConfig {
  packages?: string[];
  desktop?: boolean;
  development?: boolean;
  multimedia?: boolean;
}

export class LeafLinuxIntegration {
  private isChromeOS: boolean = false;
  private isLinuxEnabled: boolean = false;
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
    this.detectEnvironment();
  }

  /**
   * Detect ChromeOS and Linux environment
   */
  async detectEnvironment(): Promise<boolean> {
    if (!this.backend) {
      return false;
    }

    try {
      // Check if we're on ChromeOS
      const result = await this.executeCommand('test -f /etc/lsb-release && grep -q CHROMEOS /etc/lsb-release && echo "1" || echo "0"');
      this.isChromeOS = result.output.trim() === '1';

      if (this.isChromeOS) {
        // Check if Linux container is available
        const linuxResult = await this.executeCommand('which penguin-container 2>/dev/null && echo "1" || echo "0"');
        this.isLinuxEnabled = linuxResult.output.trim() === '1';
      }

      return this.isChromeOS && this.isLinuxEnabled;
    } catch (error) {
      return false;
    }
  }

  /**
   * Quick setup - initialize Linux container
   */
  async quickSetup(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Linux is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('penguin-container setup');
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Linux container setup completed' : 'Setup failed')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Setup failed' };
    }
  }

  /**
   * Install desktop environment
   */
  async installDesktop(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Linux is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('penguin-container install-desktop');
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Desktop environment installed' : 'Installation failed')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Installation failed' };
    }
  }

  /**
   * Update Linux container
   */
  async update(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Linux is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('penguin-container update');
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Container updated' : 'Update failed')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Update failed' };
    }
  }

  /**
   * Install package in Linux container
   */
  async installPackage(packageName: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Linux is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand(`penguin-container install ${packageName}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Package installed' : 'Installation failed')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Installation failed' };
    }
  }

  /**
   * Check container status
   */
  async checkStatus(): Promise<{ success: boolean; status?: any; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isChromeOS) {
      return { success: false, output: 'Leaf Linux is only available on ChromeOS' };
    }

    try {
      const result = await this.executeCommand('penguin-container status');
      return {
        success: result.exitCode === 0,
        output: result.output || 'Status check failed'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Status check failed' };
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

  getStatus(): { available: boolean; isChromeOS: boolean; isLinuxEnabled: boolean } {
    return {
      available: this.isChromeOS && this.isLinuxEnabled,
      isChromeOS: this.isChromeOS,
      isLinuxEnabled: this.isLinuxEnabled
    };
  }
}

// Export singleton instance
export const leafLinuxIntegration = new LeafLinuxIntegration();

