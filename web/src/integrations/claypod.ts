/**
 * Clay Pod Integration (BrowserPod Container Runtime)
 * Browser-based container runtime for running Python and other applications
 * Based on: https://github.com/leaningtech/browserpod-meta
 */

import type { BackendInterface } from './clayup';

export interface ClayPodConfig {
  image?: string;
  command?: string[];
  env?: Record<string, string>;
  ports?: Record<number, number>;
  volumes?: Record<string, string>;
}

export interface ClayPodContainer {
  containerId: string;
  image: string;
  status: 'running' | 'stopped' | 'paused';
  command?: string[];
}

export class ClayPodIntegration {
  private isAvailable: boolean = false;
  private backend: BackendInterface | null = null;
  private containers: Map<string, ClayPodContainer> = new Map();

  constructor(backend?: BackendInterface) {
    this.backend = backend || null;
    this.checkAvailability();
  }

  /**
   * Set backend instance
   */
  setBackend(backend: BackendInterface): void {
    this.backend = backend;
    this.checkAvailability();
  }

  /**
   * Check if BrowserPod is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend) {
      this.isAvailable = false;
      return false;
    }

    try {
      // Check if BrowserPod API is available
      const response = await fetch('http://127.0.0.1:8765/api/browserpod/containers');
      if (response.ok) {
        this.isAvailable = true;
        return true;
      }
    } catch (error) {
      // BrowserPod not available
    }

    this.isAvailable = false;
    return false;
  }

  /**
   * Create a new container
   */
  async createContainer(config: ClayPodConfig): Promise<{ success: boolean; containerId?: string; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/browserpod/container/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (result.success && result.containerId) {
        this.containers.set(result.containerId, {
          containerId: result.containerId,
          image: config.image || 'default',
          status: 'running',
          command: config.command
        });
      }

      return {
        success: result.success,
        containerId: result.containerId,
        output: result.success ? `Container created: ${result.containerId}` : result.error || 'Failed to create container'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to create container' };
    }
  }

  /**
   * List all containers
   */
  async listContainers(): Promise<{ success: boolean; containers: ClayPodContainer[]; output: string }> {
    if (!this.backend) {
      return { success: false, containers: [], output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/browserpod/containers');
      const result = await response.json();

      if (result.success) {
        this.containers.clear();
        for (const container of result.containers || []) {
          this.containers.set(container.containerId, container);
        }
      }

      return {
        success: result.success,
        containers: result.containers || [],
        output: result.success ? `${result.containers?.length || 0} container(s) running` : result.error || 'Failed to list containers'
      };
    } catch (error: any) {
      return { success: false, containers: [], output: error.message || 'Failed to list containers' };
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(containerId: string, command: string[]): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (command.length === 0) {
      return { success: false, output: 'No command provided' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/browserpod/container/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, command })
      });

      const result = await response.json();
      return {
        success: result.success,
        output: result.output || result.error || 'Command executed'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to execute command' };
    }
  }

  /**
   * Stop a container
   */
  async stopContainer(containerId: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/browserpod/container/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId })
      });

      const result = await response.json();
      
      if (result.success && this.containers.has(containerId)) {
        const container = this.containers.get(containerId)!;
        container.status = 'stopped';
      }

      return {
        success: result.success,
        output: result.success ? 'Container stopped' : result.error || 'Failed to stop container'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to stop container' };
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/browserpod/container/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId })
      });

      const result = await response.json();
      this.containers.delete(containerId);

      return {
        success: result.success,
        output: result.success ? 'Container removed' : result.error || 'Failed to remove container'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to remove container' };
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch(`http://127.0.0.1:8765/api/browserpod/container/logs?containerId=${containerId}&tail=${tail}`);
      const result = await response.json();
      
      return {
        success: result.success,
        output: result.logs || result.error || 'No logs available'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get logs' };
    }
  }

  /**
   * Run Python code in a container
   */
  async runPython(containerId: string, code: string): Promise<{ success: boolean; output: string }> {
    return this.execInContainer(containerId, ['python', '-c', code]);
  }

  /**
   * Run a Python script in a container
   */
  async runPythonScript(containerId: string, scriptPath: string): Promise<{ success: boolean; output: string }> {
    return this.execInContainer(containerId, ['python', scriptPath]);
  }

  getStatus(): { available: boolean; containers: number } {
    return {
      available: this.isAvailable,
      containers: this.containers.size
    };
  }
}

// Export singleton instance
export const clayPodIntegration = new ClayPodIntegration();

