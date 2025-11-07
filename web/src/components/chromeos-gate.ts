// ChromeOS Gate Component
// Blocks access until Linux environment is enabled

import { notificationManager } from './notification';

export interface LinuxStatus {
  enabled: boolean;
  checking: boolean;
  error?: string;
}

class ChromeOSGate {
  private container: HTMLElement | null = null;
  private isOpen: boolean = false;
  private linuxStatus: LinuxStatus = { enabled: false, checking: true };
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.createContainer();
    this.setupStyles();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'chromeos-gate';
    this.container.className = 'chromeos-gate-overlay hidden';
    document.body.appendChild(this.container);
  }

  private setupStyles(): void {
    if (!document.getElementById('chromeos-gate-styles')) {
      const style = document.createElement('style');
      style.id = 'chromeos-gate-styles';
      style.textContent = `
        .chromeos-gate-overlay {
          position: fixed;
          inset: 0;
          background: rgb(3, 7, 18);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease-out;
        }
        
        .chromeos-gate-overlay.hidden {
          display: none;
        }
        
        .chromeos-gate-content {
          background: rgb(17, 24, 39);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          width: 90%;
          max-width: 600px;
          padding: 3rem;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .chromeos-gate-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 2rem;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(234, 88, 12, 0.2));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(37, 99, 235, 0.3);
        }
        
        .chromeos-gate-icon svg {
          width: 40px;
          height: 40px;
          color: rgb(59, 130, 246);
        }
        
        .chromeos-gate-title {
          color: #e4e4e7;
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 1rem;
        }
        
        .chromeos-gate-description {
          color: #9ca3af;
          font-size: 1rem;
          line-height: 1.6;
          margin: 0 0 2rem;
        }
        
        .chromeos-gate-status {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          margin: 0 0 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }
        
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #6b7280;
          animation: pulse 2s ease-in-out infinite;
        }
        
        .status-dot.enabled {
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }
        
        .status-dot.checking {
          background: #f59e0b;
        }
        
        .status-text {
          color: #9ca3af;
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .chromeos-gate-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .gate-btn {
          padding: 1rem 2rem;
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          position: relative;
          overflow: hidden;
        }
        
        .gate-btn-primary {
          background: linear-gradient(135deg, rgb(37, 99, 235), rgb(30, 58, 138));
          color: white;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
        }
        
        .gate-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(37, 99, 235, 0.4);
        }
        
        .gate-btn-primary:active {
          transform: translateY(0);
        }
        
        .gate-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
        }
        
        .gate-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
        }
        
        .gate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .chromeos-gate-links {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .gate-link {
          color: rgb(59, 130, 246);
          text-decoration: none;
          font-size: 0.875rem;
          margin: 0 0.5rem;
          transition: color 0.2s;
        }
        
        .gate-link:hover {
          color: rgb(96, 165, 250);
          text-decoration: underline;
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
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private async checkLinuxStatus(): Promise<boolean> {
    try {
      // Use bridge API to check Linux status (only reliable method)
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        // Check multiple indicators of Linux being enabled
        return data.linuxEnabled === true || 
               (data.isChromeOS && data.developerMode && data.usbBoot);
      }
    } catch (error) {
      // Bridge not available - cannot check status reliably
      console.warn('Bridge not available, cannot check Linux status:', error);
    }
    
    return false;
  }

  // Removed checkCrostiniDirectly - all checks go through bridge API

  private async enableLinuxViaBridge(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: 'linux-env' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.success === true;
      }
    } catch (error) {
      console.error('Failed to enable Linux via bridge:', error);
    }
    
    return false;
  }

  private async enableLinuxDirectly(): Promise<boolean> {
    // This method is no longer used - all enabling is done via bridge API
    // If bridge is not available, we can't enable Linux programmatically
    return false;
  }

  private async enableBypassEnrollment(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: 'bypass-enrollment' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          notificationManager.success('Enrollment restrictions bypassed');
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to bypass enrollment:', error);
    }
    
    return false;
  }

  private render(): void {
    if (!this.container) return;

    const statusText = this.linuxStatus.checking
      ? 'Checking Linux environment...'
      : this.linuxStatus.enabled
      ? 'Linux environment is enabled'
      : 'Linux environment is not enabled';

    this.container.innerHTML = `
      <div class="chromeos-gate-content">
        <div class="chromeos-gate-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        
        <h1 class="chromeos-gate-title">Recommended: Enable Linux or Bypass Enrollment</h1>
        <p class="chromeos-gate-description">
          <strong>Good news:</strong> Clay Terminal and AI are available now! However, enabling Linux environment or bypassing enrollment unlocks:
          <br>• Full system access and advanced features
          <br>• ChromeOS hidden settings (65+ settings)
          <br>• Root-level operations and privileged APIs
        </p>
        
        <div class="chromeos-gate-note" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
          <strong style="color: #60a5fa;">ℹ️ You can continue using Clay Terminal and AI without these features.</strong>
          <br>Click "Continue to Terminal" below to use Clay now, or follow the instructions to unlock advanced features.
        </div>
        
        <div class="chromeos-gate-status">
          <div class="status-dot ${this.linuxStatus.checking ? 'checking' : this.linuxStatus.enabled ? 'enabled' : ''}"></div>
          <span class="status-text">${statusText}</span>
        </div>
        
        <div class="chromeos-gate-actions">
          ${!this.linuxStatus.enabled ? `
            <button id="gate-ultimate-bypass" class="gate-btn gate-btn-primary" style="background: linear-gradient(135deg, rgb(234, 88, 12), rgb(194, 65, 12)); font-weight: 700;">
              ⚡ Create Enrollment Bypass (Via Clay Terminal)
            </button>
            <button id="gate-bypass-policy" class="gate-btn gate-btn-secondary">
              Bypass All Policies
            </button>
            <button id="gate-enable-linux" class="gate-btn gate-btn-secondary" ${this.linuxStatus.checking ? 'disabled' : ''}>
              ${this.linuxStatus.checking ? 'Checking...' : 'Enable Linux Environment'}
            </button>
            <button id="gate-continue" class="gate-btn gate-btn-secondary" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.4); color: #10b981;">
              ✓ Continue to Terminal (Use Now)
            </button>
          ` : `
            <button id="gate-continue" class="gate-btn gate-btn-primary">
              Continue to Terminal
            </button>
          `}
        </div>
        
        <div id="gate-instructions" class="gate-instructions" style="display: block; margin-top: 1.5rem; padding: 1.5rem; background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem;">
          <h3 style="color: #f97316; margin-top: 0; margin-bottom: 1rem; font-size: 1.25rem;">📋 Enrollment Bypass Instructions (Using Clay Terminal)</h3>
          
          <div style="background: rgba(234, 88, 12, 0.1); border-left: 3px solid #ea580c; padding: 1rem; margin-bottom: 1rem; border-radius: 0.25rem;">
            <strong style="color: #f97316;">⚠️ Important:</strong> This method works even if Crosh is blocked! We use Clay Terminal itself to execute the bypass.
          </div>
          
          <div id="gate-linux-files-warning" style="display: none; background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 1rem; margin-bottom: 1rem; border-radius: 0.25rem;">
            <strong style="color: #fbbf24;">⚠️ Linux Files folder not found!</strong>
            <br><br>
            <strong style="color: #e4e4e7;">To create the Linux Files folder:</strong>
            <ol style="color: #e4e4e7; line-height: 1.8; margin: 0.5rem 0 0 1.5rem; padding: 0;">
              <li>Click the button below to open: <code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">chrome://crostini-installer</code></li>
              <li>Click the <strong style="color: #60a5fa;">blue "Install" button</strong> (even if Linux is blocked)</li>
              <li>This will create the Linux Files folder in your Files app</li>
              <li>You don't need to complete the installation - just click the button!</li>
            </ol>
            <button id="gate-open-crostini-installer" class="gate-btn gate-btn-secondary" style="margin-top: 0.75rem; width: 100%;">
              🔧 Open chrome://crostini-installer
            </button>
            <p style="color: #9ca3af; margin: 0.75rem 0 0 0; font-size: 0.875rem;">
              💡 <strong>Note:</strong> The script will be saved to an alternative location (Downloads or MyFiles) if Linux Files doesn't exist.
            </p>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #e4e4e7; margin-top: 0; margin-bottom: 0.75rem;">Method 1: Via Clay Terminal Command (Recommended)</h4>
            <ol style="color: #e4e4e7; line-height: 1.8; margin: 0; padding-left: 1.5rem;">
              <li>Click "⚡ Create Enrollment Bypass" above to create the bypass script</li>
              <li>In Clay Terminal, type: <code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">bypass-enrollment</code></li>
              <li>Clay will execute the bypass script via the bridge server</li>
              <li>After completion, restart Chrome: <code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">chrome://restart</code></li>
            </ol>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #e4e4e7; margin-top: 0; margin-bottom: 0.75rem;">Method 2: Manual Script Execution (If Bridge Not Available)</h4>
            <ol style="color: #e4e4e7; line-height: 1.8; margin: 0; padding-left: 1.5rem;">
              <li>Click "⚡ Create Enrollment Bypass" to create the script</li>
              <li>Script will be saved to one of these locations (in order of preference):
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                  <li><code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">Linux Files/clay_terminal_bypass.sh</code></li>
                  <li><code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">MyFiles/clay_terminal_bypass.sh</code></li>
                  <li><code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">Downloads/clay_terminal_bypass.sh</code></li>
                </ul>
              </li>
              <li>In Clay Terminal, type: <code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">bash ~/LinuxFiles/clay_terminal_bypass.sh</code> (or the path shown after creation)</li>
              <li>After completion, restart Chrome: <code style="background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace;">chrome://restart</code></li>
            </ol>
          </div>
          
          <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 1rem; border-radius: 0.25rem;">
            <strong style="color: #60a5fa;">💡 Tip:</strong> The bypass script is executed through Clay Terminal's bridge server, which runs in the Linux container. This works even if Crosh is blocked by policy!
          </div>
          
          <div style="margin-top: 1rem; display: flex; gap: 0.75rem;">
            <button id="gate-restart-chrome" class="gate-btn gate-btn-secondary" style="flex: 1;">
              🔄 Restart Chrome Now (chrome://restart)
            </button>
            <button id="gate-quit-chrome" class="gate-btn gate-btn-secondary" style="flex: 1;">
              🚪 Quit Chrome (chrome://quit)
            </button>
          </div>
        </div>
        
        <div class="chromeos-gate-links">
          <button id="gate-start-bridge" class="gate-link" style="background: none; border: none; cursor: pointer;">Start Bridge Server</button>
          <span class="gate-link" style="color: #6b7280;">|</span>
          <span class="gate-link" style="color: #6b7280;">All settings are enabled via bridge API</span>
        </div>
      </div>
    `;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const ultimateBypassBtn = document.getElementById('gate-ultimate-bypass');
    const openCroshBtn = document.getElementById('gate-open-crosh');
    const restartChromeBtn = document.getElementById('gate-restart-chrome');
    const bypassPolicyBtn = document.getElementById('gate-bypass-policy');
    const enableBtn = document.getElementById('gate-enable-linux');
    const continueBtn = document.getElementById('gate-continue');
    const instructionsEl = document.getElementById('gate-instructions');

    // Show/hide instructions
    openCroshBtn?.addEventListener('click', () => {
      if (instructionsEl) {
        instructionsEl.style.display = instructionsEl.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Restart Chrome
    restartChromeBtn?.addEventListener('click', () => {
      if (confirm('This will restart Chrome. All tabs will be restored. Continue?')) {
        window.open('chrome://restart', '_blank');
        if (typeof (window as any).notificationManager !== 'undefined') {
          (window as any).notificationManager.info('Chrome restart initiated. Tabs will be restored.');
        }
      }
    });

    // Quit Chrome
    const quitChromeBtn = document.getElementById('gate-quit-chrome');
    quitChromeBtn?.addEventListener('click', () => {
      if (confirm('This will close Chrome completely. Continue?')) {
        window.open('chrome://quit', '_blank');
        if (typeof (window as any).notificationManager !== 'undefined') {
          (window as any).notificationManager.info('Chrome quit initiated.');
        }
      }
    });

    // Open Crostini Installer
    const openCrostiniBtn = document.getElementById('gate-open-crostini-installer');
    openCrostiniBtn?.addEventListener('click', () => {
      window.open('chrome://crostini-installer', '_blank');
      if (typeof (window as any).notificationManager !== 'undefined') {
        (window as any).notificationManager.info('Opening Crostini installer. Click the blue Install button to create Linux Files folder.');
      }
    });

    // ULTIMATE: Ultimate enrollment bypass with clear instructions
    ultimateBypassBtn?.addEventListener('click', async () => {
      // Show detailed instructions first
      const instructions = `
🔧 ENROLLMENT BYPASS INSTRUCTIONS

Clay will create bypass scripts using modern methods that work on newer ChromeOS versions.

📋 STEP-BY-STEP PROCESS:

1. Clay creates bypass scripts in your Linux Files folder
2. You'll need to execute them via Crosh shell (Ctrl+Alt+T)
3. After execution, restart Chrome (chrome://restart)

⚠️ IMPORTANT:
- This requires Developer Mode or Crosh access
- Scripts will be saved to: Linux Files/clay_crosh_bypass.sh
- You must manually execute the script in Crosh
- Then restart Chrome to apply changes

Would you like to proceed with creating the bypass scripts?
      `;

      if (!confirm(instructions)) {
        return;
      }

      this.linuxStatus.checking = true;
      this.render();
      
      try {
        notificationManager.info('Creating enrollment bypass scripts...');
        
        const response = await fetch('http://127.0.0.1:8765/api/chromeos/enrollment/ultimate-bypass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bypassWP: false, methods: 'system' }) // Focus on working methods
        });

      if (response.ok) {
        const data = await response.json();
        
        // Check if Linux Files exists and show warning if not
        const linuxFilesWarning = document.getElementById('gate-linux-files-warning');
        if (linuxFilesWarning) {
          if (!data.hasLinuxFiles) {
            linuxFilesWarning.style.display = 'block';
          } else {
            linuxFilesWarning.style.display = 'none';
          }
        }
        
        // Show detailed instructions
        const scriptLocation = data.saveLocation || data.scriptPath || 'Linux Files';
        const nextSteps = `
✅ BYPASS SCRIPTS CREATED!

📁 Scripts saved to: ${scriptLocation}/clay_terminal_bypass.sh
${!data.hasLinuxFiles ? '\n⚠️ Linux Files folder not found - script saved to alternative location!' : ''}

🔧 NEXT STEPS:

Method 1 (Recommended - Via Clay Terminal):
1. In Clay Terminal, type: bypass-enrollment
2. Clay will execute the script automatically
3. After completion, restart Chrome: chrome://restart

Method 2 (Alternative - Manual):
1. In Clay Terminal, type: bash ${data.scriptPath || '~/LinuxFiles/clay_terminal_bypass.sh'}
2. After script completes, restart Chrome: chrome://restart

${!data.hasLinuxFiles ? '\n💡 To create Linux Files folder:\n   Open chrome://crostini-installer and click the blue Install button\n   (You don\'t need to complete installation - just click the button!)' : ''}

Would you like to open chrome://restart now?
        `;

        if (confirm(nextSteps)) {
          // Open chrome://restart
          window.open('chrome://restart', '_blank');
        }

        notificationManager.success(`Bypass scripts created! Saved to: ${scriptLocation}`);
        this.linuxStatus.checking = false;
        this.render();
        } else {
          const errorData = await response.json().catch(() => ({}));
          notificationManager.error(`Failed to create bypass scripts: ${errorData.error || 'Unknown error'}`);
          this.linuxStatus.checking = false;
          this.render();
        }
      } catch (error) {
        notificationManager.error('Bridge server not available. Please start: cd bridge && npm start');
        this.linuxStatus.checking = false;
        this.render();
      }
    });

    // CRITICAL: Bypass all policies first - this allows all settings to work
    bypassPolicyBtn?.addEventListener('click', async () => {
      this.linuxStatus.checking = true;
      this.render();
      
      try {
        const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setting: 'bypass-policy-enforcement' })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            notificationManager.success('All policies bypassed! You can now use all settings.');
            // Close gate and allow access
            setTimeout(() => {
              this.close();
              // Reload to apply changes
              window.location.reload();
            }, 1500);
            return;
          }
        }
        
        notificationManager.error('Failed to bypass policies. Make sure bridge server is running.');
        this.linuxStatus.checking = false;
        this.render();
      } catch (error) {
        notificationManager.error('Bridge server not available. Please start: cd bridge && npm start');
        this.linuxStatus.checking = false;
        this.render();
      }
    });

    enableBtn?.addEventListener('click', async () => {
      this.linuxStatus.checking = true;
      this.render();
      
      // Enable Linux via bridge API only (no chrome:// URLs)
      const success = await this.enableLinuxViaBridge();
      
      if (success) {
        notificationManager.success('Linux environment enabled! Checking status...');
        // Wait a bit then recheck
        setTimeout(async () => {
          await this.updateStatus();
        }, 2000);
      } else {
        this.linuxStatus.checking = false;
        this.render();
      }
    });


    continueBtn?.addEventListener('click', () => {
      this.close();
    });

    const startBridgeBtn = document.getElementById('gate-start-bridge');
    startBridgeBtn?.addEventListener('click', () => {
      notificationManager.info('Please start the bridge server: cd bridge && npm start');
    });
  }

  async updateStatus(): Promise<void> {
    this.linuxStatus.checking = true;
    this.render();
    
    const enabled = await this.checkLinuxStatus();
    this.linuxStatus.enabled = enabled;
    this.linuxStatus.checking = false;
    
    this.render();
    
    if (enabled) {
      notificationManager.success('Linux environment is enabled! You can now continue.');
    }
  }

  async open(): Promise<void> {
    if (!this.container) return;
    
    this.isOpen = true;
    this.container.classList.remove('hidden');
    
    // Check Linux status
    await this.updateStatus();
    
    // Periodically check status
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      if (this.isOpen && !this.linuxStatus.enabled) {
        await this.updateStatus();
      } else if (this.linuxStatus.enabled && this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }, 5000);
  }

  close(): void {
    if (!this.container) return;
    
    this.isOpen = false;
    this.container.classList.add('hidden');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  isLinuxEnabled(): boolean {
    return this.linuxStatus.enabled;
  }

  async checkAndBlock(): Promise<boolean> {
    // NEVER block access - Clay terminal and AI are always available
    // Just show recommendation banner if on ChromeOS
    if (!this.isChromeOS()) {
      return false; // Don't show on non-ChromeOS
    }
    
    // Check if Linux is enabled or policy bypass is active
    try {
      const policyBypassResponse = await fetch('http://127.0.0.1:8765/api/chromeos/settings/verify/bypass-policy-enforcement', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => null);
      
      if (policyBypassResponse?.ok) {
        const data = await policyBypassResponse.json();
        if (data.verified === true) {
          // Policy bypass is enabled - no need to show recommendation
          return false;
        }
      }
    } catch (error) {
      // Bridge not available - continue
    }
    
    const enabled = await this.checkLinuxStatus();
    if (!enabled) {
      // Show as recommendation banner (non-blocking)
      this.showRecommendationBanner();
      return false; // Don't block - allow access
    }
    
    return false; // Always allow access
  }

  private showRecommendationBanner(): void {
    // Create recommendation banner instead of blocking gate
    if (document.getElementById('chromeos-recommendation-banner')) {
      return; // Already shown
    }

    const banner = document.createElement('div');
    banner.id = 'chromeos-recommendation-banner';
    banner.className = 'chromeos-recommendation-banner';
    banner.innerHTML = `
      <div class="recommendation-content">
        <div class="recommendation-icon">💡</div>
        <div class="recommendation-text">
          <strong>Recommended:</strong> Enable Linux environment or bypass enrollment for full system access and advanced features.
          <button id="recommendation-show-instructions" class="recommendation-btn">Show Instructions</button>
          <button id="recommendation-dismiss" class="recommendation-btn-dismiss">×</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(banner);
    this.setupRecommendationBannerStyles();
    this.setupRecommendationBannerHandlers(banner);
  }

  private setupRecommendationBannerStyles(): void {
    if (document.getElementById('recommendation-banner-styles')) return;

    const style = document.createElement('style');
    style.id = 'recommendation-banner-styles';
    style.textContent = `
      .chromeos-recommendation-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, rgba(234, 88, 12, 0.95), rgba(194, 65, 12, 0.95));
        border-bottom: 2px solid rgba(234, 88, 12, 0.5);
        z-index: 10000;
        padding: 0.75rem 1rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      
      .recommendation-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        max-width: 1400px;
        margin: 0 auto;
      }
      
      .recommendation-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }
      
      .recommendation-text {
        flex: 1;
        color: #ffffff;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      
      .recommendation-btn {
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 0.5rem;
        color: #ffffff;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .recommendation-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }
      
      .recommendation-btn-dismiss {
        background: none;
        border: none;
        color: #ffffff;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      
      .recommendation-btn-dismiss:hover {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  private setupRecommendationBannerHandlers(banner: HTMLElement): void {
    const showInstructionsBtn = banner.querySelector('#recommendation-show-instructions');
    const dismissBtn = banner.querySelector('#recommendation-dismiss');

    showInstructionsBtn?.addEventListener('click', () => {
      this.open(); // Open full gate with instructions
    });

    dismissBtn?.addEventListener('click', () => {
      banner.remove();
      // Store dismissal in localStorage
      localStorage.setItem('clay_chromeos_recommendation_dismissed', 'true');
    });

    // Check if user previously dismissed
    if (localStorage.getItem('clay_chromeos_recommendation_dismissed') === 'true') {
      banner.remove();
    }
  }

  private isChromeOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('cros') || ua.includes('chromeos')) {
      return true;
    }
    
    if ((navigator as any).userAgentData?.platform === 'Chrome OS') {
      return true;
    }
    
    return false;
  }
}

export const chromeOSGate = new ChromeOSGate();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).chromeOSGate = chromeOSGate;
}

