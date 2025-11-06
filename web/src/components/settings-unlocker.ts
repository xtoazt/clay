// ChromeOS Settings Unlocker UI Component
// Provides easy access to all hidden ChromeOS settings

export interface Setting {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled?: boolean;
}

class SettingsUnlockerUI {
  private container: HTMLElement | null = null;
  private isOpen: boolean = false;
  private settings: Setting[] = [];
  private status: any = null;

  constructor() {
    this.createContainer();
    this.setupStyles();
    this.loadSettings();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'settings-unlocker';
    this.container.className = 'settings-unlocker-overlay hidden';
    this.container.innerHTML = `
      <div class="settings-unlocker-content">
        <div class="settings-unlocker-header">
          <h2 class="settings-unlocker-title">ChromeOS Hidden Settings</h2>
          <button id="settings-unlocker-close" class="settings-unlocker-close-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="settings-unlocker-tabs">
          <button class="settings-tab active" data-category="all">All</button>
          <button class="settings-tab" data-category="Features">Features</button>
          <button class="settings-tab" data-category="Developer">Developer</button>
          <button class="settings-tab" data-category="User Management">User Management</button>
          <button class="settings-tab" data-category="Security">Security</button>
        </div>
        
        <div id="settings-unlocker-list" class="settings-unlocker-list">
          <!-- Settings will be populated here -->
        </div>
        
        <div class="settings-unlocker-footer">
          <button id="settings-unlocker-refresh" class="settings-unlocker-btn secondary">
            Refresh Status
          </button>
          <button id="settings-unlocker-enable-all" class="settings-unlocker-btn primary">
            Enable All Settings
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    this.setupEventHandlers();
  }

  private setupStyles(): void {
    if (!document.getElementById('settings-unlocker-styles')) {
      const style = document.createElement('style');
      style.id = 'settings-unlocker-styles';
      style.textContent = `
        .settings-unlocker-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 10002;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }
        
        .settings-unlocker-overlay.hidden {
          display: none;
        }
        
        .settings-unlocker-content {
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          width: 90%;
          max-width: 800px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .settings-unlocker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .settings-unlocker-title {
          color: #e4e4e7;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }
        
        .settings-unlocker-close-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .settings-unlocker-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
          transform: scale(1.05);
        }
        
        .settings-unlocker-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          overflow-x: auto;
        }
        
        .settings-tab {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: #9ca3af;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        
        .settings-tab:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
        }
        
        .settings-tab.active {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }
        
        .settings-unlocker-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
        
        .settings-unlocker-list::-webkit-scrollbar {
          width: 8px;
        }
        
        .settings-unlocker-list::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .settings-unlocker-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        
        .setting-item {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          margin-bottom: 0.75rem;
          transition: all 0.2s;
        }
        
        .setting-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }
        
        .setting-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        
        .setting-item-name {
          color: #e4e4e7;
          font-size: 1rem;
          font-weight: 600;
        }
        
        .setting-item-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6b7280;
        }
        
        .status-dot.enabled {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }
        
        .status-text {
          color: #9ca3af;
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .setting-item-description {
          color: #9ca3af;
          font-size: 0.875rem;
          margin-bottom: 0.75rem;
          line-height: 1.5;
        }
        
        .setting-item-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .setting-btn {
          padding: 0.5rem 1rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          color: #60a5fa;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .setting-btn:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
          transform: translateY(-1px);
        }
        
        .setting-btn:active {
          transform: translateY(0);
        }
        
        .settings-unlocker-footer {
          display: flex;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }
        
        .settings-unlocker-btn {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .settings-unlocker-btn.primary {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }
        
        .settings-unlocker-btn.primary:hover {
          background: rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.4);
        }
        
        .settings-unlocker-btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
        }
        
        .settings-unlocker-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private setupEventHandlers(): void {
    const closeBtn = document.getElementById('settings-unlocker-close');
    const refreshBtn = document.getElementById('settings-unlocker-refresh');
    const enableAllBtn = document.getElementById('settings-unlocker-enable-all');
    const tabs = this.container?.querySelectorAll('.settings-tab');

    closeBtn?.addEventListener('click', () => this.close());
    
    this.container?.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    refreshBtn?.addEventListener('click', () => {
      this.loadSettings();
    });

    enableAllBtn?.addEventListener('click', async () => {
      await this.enableAllSettings();
    });

    tabs?.forEach(tab => {
      tab.addEventListener('click', () => {
        const category = tab.getAttribute('data-category');
        this.switchCategory(category || 'all');
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // Keyboard shortcut: Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      // Fetch available settings from backend
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/list');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.settings) {
        this.settings = data.settings;
      } else {
        // Fallback to default settings list
        this.settings = this.getDefaultSettings();
      }

      // Fetch current status (silently fail if bridge not available)
      try {
        await this.refreshStatus();
      } catch (statusError) {
        console.warn('Could not refresh settings status (bridge not available):', statusError);
      }
      
      this.render();
    } catch (error) {
      // Bridge not available - use default settings
      console.warn('Bridge not available, using default settings:', error);
      this.settings = this.getDefaultSettings();
      this.render();
    }
  }

  private getDefaultSettings(): Setting[] {
    return [
      {
        id: 'linux-env',
        name: 'Enable Linux Environment',
        description: 'Enable Crostini (Linux container) support',
        category: 'Features'
      },
      {
        id: 'adb',
        name: 'Enable ADB Connection',
        description: 'Enable Android Debug Bridge and USB debugging',
        category: 'Developer'
      },
      {
        id: 'guest-mode',
        name: 'Enable Guest Mode',
        description: 'Allow guest user sessions',
        category: 'User Management'
      },
      {
        id: 'developer-mode',
        name: 'Enable Developer Mode',
        description: 'Enable all developer features and flags',
        category: 'Developer'
      },
      {
        id: 'user-accounts',
        name: 'Enable User Account Management',
        description: 'Allow creating and managing user accounts',
        category: 'User Management'
      },
      {
        id: 'developer-features',
        name: 'Enable All Developer Features',
        description: 'Enable all experimental and developer Chrome flags',
        category: 'Developer'
      },
      {
        id: 'bypass-enrollment',
        name: 'Bypass Enrollment Restrictions',
        description: 'Remove enterprise enrollment requirements',
        category: 'Security'
      },
      {
        id: 'all-settings',
        name: 'Enable All Settings',
        description: 'Enable all hidden settings at once',
        category: 'All'
      }
    ];
  }

  private async refreshStatus(): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/status');
      const data = await response.json();
      this.status = data;
      
      // Update settings with status
      this.settings.forEach(setting => {
        if (this.status) {
          switch (setting.id) {
            case 'linux-env':
              setting.enabled = this.status.linuxEnabled;
              break;
            case 'adb':
              setting.enabled = this.status.adbEnabled;
              break;
            case 'guest-mode':
              setting.enabled = this.status.guestMode;
              break;
            case 'developer-mode':
              setting.enabled = this.status.developerMode;
              break;
            case 'bypass-enrollment':
              setting.enabled = this.status.enrollmentBypassed;
              break;
          }
        }
      });
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  }

  private switchCategory(category: string): void {
    this.render(category);
  }

  private render(category: string = 'all'): void {
    const list = document.getElementById('settings-unlocker-list');
    if (!list) return;

    const filtered = category === 'all' 
      ? this.settings 
      : this.settings.filter(s => s.category === category);

    list.innerHTML = '';

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #6b7280;">
          No settings found in this category
        </div>
      `;
      return;
    }

    filtered.forEach(setting => {
      const item = document.createElement('div');
      item.className = 'setting-item';
      item.innerHTML = `
        <div class="setting-item-header">
          <div class="setting-item-name">${setting.name}</div>
          <div class="setting-item-status">
            <div class="status-dot ${setting.enabled ? 'enabled' : ''}"></div>
            <span class="status-text">${setting.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
        <div class="setting-item-description">${setting.description}</div>
        <div class="setting-item-actions">
          <button class="setting-btn" data-setting-id="${setting.id}" data-action="enable">
            ${setting.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      `;

      const enableBtn = item.querySelector('[data-action="enable"]');
      enableBtn?.addEventListener('click', () => {
        this.toggleSetting(setting.id);
      });

      list.appendChild(item);
    });
  }

  private async toggleSetting(settingId: string): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: settingId })
      });

      const data = await response.json();
      
      if (data.success) {
        await this.refreshStatus();
        this.render();
        if (typeof (window as any).notificationManager !== 'undefined') {
          (window as any).notificationManager.success(`Setting ${data.enabled ? 'enabled' : 'disabled'} successfully`);
        }
      } else {
        if (typeof (window as any).notificationManager !== 'undefined') {
          (window as any).notificationManager.error(data.error || 'Failed to toggle setting');
        }
      }
    } catch (error: any) {
      console.error('Failed to toggle setting:', error);
      if (typeof (window as any).notificationManager !== 'undefined') {
        (window as any).notificationManager.error(`Failed to toggle setting: ${error.message}`);
      }
    }
  }

  private async enableAllSettings(): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/enable-all', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        await this.refreshStatus();
        this.render();
        if (typeof (window as any).notificationManager !== 'undefined') {
          (window as any).notificationManager.success('All settings enabled successfully');
        }
      } else {
        if (typeof (window as any).notificationManager !== 'undefined') {
          (window as any).notificationManager.error(data.error || 'Failed to enable all settings');
        }
      }
    } catch (error: any) {
      console.error('Failed to enable all settings:', error);
      if (typeof (window as any).notificationManager !== 'undefined') {
        (window as any).notificationManager.error(`Failed to enable all settings: ${error.message}`);
      }
    }
  }

  open(): void {
    if (!this.container) return;
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.loadSettings();
  }

  close(): void {
    if (!this.container) return;
    this.isOpen = false;
    this.container.classList.add('hidden');
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

export const settingsUnlockerUI = new SettingsUnlockerUI();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).settingsUnlockerUI = settingsUnlockerUI;
}

