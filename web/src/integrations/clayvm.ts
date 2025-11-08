/**
 * Clay VM Integration (Clay Virtual Machine Management)
 * Virtual machine management via VirtualBox
 * Based on: https://github.com/VirtualBox/virtualbox
 */

import type { BackendInterface } from './clayup';

export interface ClayVM {
  name: string;
  uuid: string;
  state: 'running' | 'poweredoff' | 'saved' | 'paused' | 'aborted';
  osType: string;
  memory: number;
  vram: number;
}

export interface ClayVMConfig {
  name: string;
  osType?: string;
  memory?: number; // MB
  vram?: number; // MB
  hdd?: number; // MB
  network?: 'nat' | 'bridged' | 'hostonly' | 'internal';
}

export class ClayVMIntegration {
  private isAvailable: boolean = false;
  private version: string | null = null;
  private backend: BackendInterface | null = null;

  constructor(backend?: BackendInterface) {
    this.backend = backend || null;
    if (backend) {
      this.checkAvailability();
    }
  }

  /**
   * Set backend instance
   */
  setBackend(backend: BackendInterface): void {
    this.backend = backend;
    this.checkAvailability();
  }

  /**
   * Check if VirtualBox is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend) {
      this.isAvailable = false;
      return false;
    }

    try {
      const result = await this.executeCommand('which VBoxManage');
      this.isAvailable = result.exitCode === 0;
      if (this.isAvailable) {
        const versionResult = await this.executeCommand('VBoxManage --version');
        if (versionResult.exitCode === 0) {
          this.version = versionResult.output.trim();
        }
      }
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * List all VMs
   */
  async listVMs(): Promise<{ success: boolean; vms?: ClayVM[]; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand('VBoxManage list vms');
      return {
        success: result.exitCode === 0,
        output: result.output || 'No VMs found'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to list VMs' };
    }
  }

  /**
   * Get VM information
   */
  async getVMInfo(vmNameOrUuid: string): Promise<{ success: boolean; info?: any; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand(`VBoxManage showvminfo "${vmNameOrUuid}"`);
      return {
        success: result.exitCode === 0,
        output: result.output || 'VM information retrieved'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get VM info' };
    }
  }

  /**
   * Create a new VM
   */
  async createVM(config: ClayVMConfig): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const commands = [
        `VBoxManage createvm --name "${config.name}" --register`,
        `VBoxManage modifyvm "${config.name}" --memory ${config.memory || 1024}`,
        `VBoxManage modifyvm "${config.name}" --vram ${config.vram || 128}`
      ];

      if (config.osType) {
        commands.push(`VBoxManage modifyvm "${config.name}" --ostype ${config.osType}`);
      }

      let output = '';
      for (const cmd of commands) {
        const result = await this.executeCommand(cmd);
        output += result.output + '\n';
        if (result.exitCode !== 0) {
          return { success: false, output: result.output };
        }
      }

      return {
        success: true,
        output: output || 'VM created successfully'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to create VM' };
    }
  }

  /**
   * Start a VM
   */
  async startVM(vmNameOrUuid: string, headless: boolean = false): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const mode = headless ? '--type headless' : '--type gui';
      const result = await this.executeCommand(`VBoxManage startvm "${vmNameOrUuid}" ${mode}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'VM started' : 'Failed to start VM')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to start VM' };
    }
  }

  /**
   * Stop a VM
   */
  async stopVM(vmNameOrUuid: string, force: boolean = false): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const method = force ? 'poweroff' : 'acpipowerbutton';
      const result = await this.executeCommand(`VBoxManage controlvm "${vmNameOrUuid}" ${method}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'VM stopped' : 'Failed to stop VM')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to stop VM' };
    }
  }

  /**
   * Delete a VM
   */
  async deleteVM(vmNameOrUuid: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand(`VBoxManage unregistervm "${vmNameOrUuid}" --delete`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'VM deleted' : 'Failed to delete VM')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to delete VM' };
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

  getStatus(): { available: boolean; version: string | null } {
    return {
      available: this.isAvailable,
      version: this.version
    };
  }
}

// Export singleton instance
export const clayVMIntegration = new ClayVMIntegration();

