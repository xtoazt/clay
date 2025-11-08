/**
 * Clay Emulator Integration (Clay x86 Emulator)
 * x86 PC emulator and x86-to-WebAssembly JIT compiler
 * Based on: https://github.com/copy/v86
 * 
 * This integration enhances WebVM with x86 emulation capabilities
 */

export interface ClayEmulatorConfig {
  memory_size?: number; // Memory size in MB
  vga_memory_size?: number; // VGA memory size in MB
  screen_container?: HTMLElement;
  bios?: {
    url: string;
  };
  vga_bios?: {
    url: string;
  };
  cdrom?: {
    url?: string;
    async?: boolean;
  };
  hda?: {
    url?: string;
    async?: boolean;
    size?: number;
  };
  network_relay_url?: string;
  autostart?: boolean;
}

export class ClayEmulator {
  private config: ClayEmulatorConfig;
  private emulator: any = null;
  private isRunning: boolean = false;

  constructor(config: ClayEmulatorConfig) {
    this.config = config;
  }

  /**
   * Create and start the emulator
   */
  async start(): Promise<{ success: boolean; error?: string }> {
    try {
      // Dynamic import of v86 library
      if (typeof window !== 'undefined') {
        // Check if v86 is available
        if (!(window as any).V86Starter) {
          // Try to load v86 library
          await this.loadV86Library();
        }

        if ((window as any).V86Starter) {
          this.emulator = new (window as any).V86Starter(this.config);
          this.isRunning = true;
          return { success: true };
        } else {
          return { success: false, error: 'v86 library not available' };
        }
      } else {
        return { success: false, error: 'Browser environment required' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop the emulator
   */
  stop(): void {
    if (this.emulator) {
      try {
        this.emulator.stop();
        this.isRunning = false;
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Load v86 library dynamically
   */
  private async loadV86Library(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Browser environment required'));
        return;
      }

      if ((window as any).V86Starter) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@copy/v86@latest/build/libv86.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load v86 library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Get emulator instance
   */
  getEmulator(): any {
    return this.emulator;
  }

  /**
   * Check if emulator is running
   */
  isEmulatorRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Clay Emulator Utilities
 */
export class ClayEmulatorUtils {
  /**
   * Check if v86 is available
   */
  static isAvailable(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    // Check if v86 library is loaded or can be loaded
    return !!(window as any).V86Starter || typeof document !== 'undefined';
  }

  /**
   * Create a new emulator instance
   */
  static createEmulator(config: ClayEmulatorConfig): ClayEmulator {
    return new ClayEmulator(config);
  }

  /**
   * Get default BIOS URLs
   */
  static getDefaultBIOS(): { bios: string; vgaBios: string } {
    return {
      bios: 'https://unpkg.com/@copy/v86@latest/bios/seabios.bin',
      vgaBios: 'https://unpkg.com/@copy/v86@latest/bios/vgabios.bin'
    };
  }
}

// Export utilities
export const clayEmulatorUtils = ClayEmulatorUtils;

