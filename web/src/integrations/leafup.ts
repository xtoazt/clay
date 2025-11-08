/**
 * Leafup Integration (Azalea Development Environment)
 * Development environment setup tool for Chromebook/ChromeOS, macOS, and Linux
 * 
 * Leafup provides a streamlined way to set up and manage development environments
 * across different platforms. It uses Nix-based package management to ensure
 * consistent environments and easy package installation.
 * 
 * Based on: https://github.com/tsirysndr/crosup
 */

export interface LeafupConfig {
  packages?: string[];
  tools?: string[];
  autoInstall?: boolean;
}

export interface BackendInterface {
  executeCommand(command: string, cwd?: string): Promise<{ exitCode: number; output: string }>;
}

export class LeafupIntegration {
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
   * Check if crosup is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend) {
      this.isAvailable = false;
      return false;
    }

    try {
      const result = await this.executeCommand('which crosup');
      this.isAvailable = result.exitCode === 0;
      if (this.isAvailable) {
        const versionResult = await this.executeCommand('crosup --version');
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
   * Install crosup (required for leafup)
   */
  async installCrosup(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand('curl -fsSL https://raw.githubusercontent.com/tsirysndr/crosup/main/install.sh | sh');
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Crosup installed successfully' : 'Failed to install crosup')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to install crosup' };
    }
  }

  /**
   * Initialize configuration
   */
  async initConfig(format: 'toml' | 'hcl' = 'toml'): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand(`crosup init --format ${format}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Configuration initialized' : 'Failed to initialize configuration')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to initialize configuration' };
    }
  }

  /**
   * Install packages
   */
  async installPackages(packages: string[]): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (packages.length === 0) {
      return { success: false, output: 'No packages specified' };
    }

    try {
      const result = await this.executeCommand(`crosup install ${packages.join(' ')}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Packages installed' : 'Failed to install packages')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to install packages' };
    }
  }

  /**
   * Add package to configuration
   */
  async addPackage(packageName: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand(`crosup add ${packageName}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Package added to configuration' : 'Failed to add package')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to add package' };
    }
  }

  /**
   * Search for packages
   */
  async searchPackage(query: string): Promise<{ success: boolean; results?: any[]; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand(`crosup search ${query}`);
      return {
        success: result.exitCode === 0,
        output: result.output || (result.exitCode === 0 ? 'Search completed' : 'Search failed')
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Search failed' };
    }
  }

  /**
   * Show configuration diff
   */
  async showDiff(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand('crosup diff');
      return {
        success: result.exitCode === 0,
        output: result.output || 'No differences found'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to show diff' };
    }
  }

  /**
   * Show configuration history
   */
  async showHistory(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const result = await this.executeCommand('crosup history');
      return {
        success: result.exitCode === 0,
        output: result.output || 'No history available'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to show history' };
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
export const leafupIntegration = new LeafupIntegration();

