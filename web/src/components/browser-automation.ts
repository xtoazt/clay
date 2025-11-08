/**
 * Browser Automation Component
 * Visual interface for Puppeteer browser automation
 */

import { notificationManager } from './notification';
import { clayPuppeteerIntegration } from '../integrations/claypuppeteer';
import type { PuppeteerBrowser, PuppeteerPage } from '../integrations/claypuppeteer';

export class BrowserAutomation {
  private container: HTMLElement | null = null;
  public isVisible: boolean = false;
  private browsers: PuppeteerBrowser[] = [];
  private pages: PuppeteerPage[] = [];
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.createContainer();
    this.setupEventListeners();
  }

  /**
   * Create the browser automation container
   */
  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'browser-automation';
    this.container.className = 'browser-automation-container';
    this.container.innerHTML = `
      <div class="browser-automation-header">
        <div class="browser-automation-title">
          <i data-lucide="globe"></i>
          <span>Browser Automation</span>
        </div>
        <div class="browser-automation-actions">
          <button id="ba-launch" class="ba-btn" title="Launch Browser">
            <i data-lucide="play"></i>
            <span>Launch</span>
          </button>
          <button id="ba-refresh" class="ba-btn" title="Refresh">
            <i data-lucide="refresh-cw"></i>
          </button>
          <button id="ba-toggle" class="ba-btn" title="Toggle Browser Automation">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
      <div class="browser-automation-content">
        <div class="ba-section">
          <div class="ba-section-header">
            <h3>Browsers</h3>
            <button id="ba-launch-browser" class="ba-btn-small">
              <i data-lucide="plus"></i>
              New Browser
            </button>
          </div>
          <div id="ba-browsers-list" class="ba-browsers-list">
            <div class="ba-loading">Loading browsers...</div>
          </div>
        </div>
        <div class="ba-section">
          <div class="ba-section-header">
            <h3>Pages</h3>
          </div>
          <div id="ba-pages-list" class="ba-pages-list">
            <div class="ba-loading">Loading pages...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    
    // Initialize Lucide icons
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    // Toggle visibility
    const toggleBtn = document.getElementById('ba-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }

    // Launch browser
    const launchBtn = document.getElementById('ba-launch');
    const launchBrowserBtn = document.getElementById('ba-launch-browser');
    
    if (launchBtn) {
      launchBtn.addEventListener('click', () => this.launchBrowser());
    }
    if (launchBrowserBtn) {
      launchBrowserBtn.addEventListener('click', () => this.launchBrowser());
    }

    // Refresh
    const refreshBtn = document.getElementById('ba-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.container) {
      if (this.isVisible) {
        this.container.classList.add('visible');
        this.refresh();
        this.startAutoRefresh();
      } else {
        this.container.classList.remove('visible');
        this.stopAutoRefresh();
      }
    }
  }

  /**
   * Show browser automation panel
   */
  show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.classList.add('visible');
      this.refresh();
      this.startAutoRefresh();
    }
  }

  /**
   * Hide browser automation panel
   */
  hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.classList.remove('visible');
      this.stopAutoRefresh();
    }
  }

  /**
   * Launch a new browser
   */
  private async launchBrowser(): Promise<void> {
    try {
      notificationManager.info('Launching browser...');
      const result = await clayPuppeteerIntegration.launchBrowser(true);
      
      if (result.success) {
        notificationManager.success(`Browser launched: ${result.browserId}`);
        await this.refresh();
      } else {
        notificationManager.error(result.output);
      }
    } catch (error: any) {
      notificationManager.error(`Failed to launch browser: ${error.message}`);
    }
  }

  /**
   * Refresh browser and page lists
   */
  async refresh(): Promise<void> {
    await this.refreshBrowsers();
    await this.refreshPages();
  }

  /**
   * Refresh browsers list
   */
  private async refreshBrowsers(): Promise<void> {
    const browsersList = document.getElementById('ba-browsers-list');
    if (!browsersList) return;

    try {
      const result = await clayPuppeteerIntegration.listBrowsers();
      
      if (result.success) {
        this.browsers = result.browsers;
        
        if (this.browsers.length === 0) {
          browsersList.innerHTML = '<div class="ba-empty">No browsers running</div>';
          return;
        }

        let html = '';
        for (const browser of this.browsers) {
          html += `
            <div class="ba-browser-item">
              <div class="ba-browser-info">
                <div class="ba-browser-icon">
                  <i data-lucide="globe"></i>
                </div>
                <div class="ba-browser-details">
                  <div class="ba-browser-id">${this.escapeHtml(browser.browserId)}</div>
                  <div class="ba-browser-status">
                    <span class="ba-status-dot ${browser.connected ? 'connected' : 'disconnected'}"></span>
                    ${browser.connected ? 'Connected' : 'Disconnected'} • ${browser.pages.length} page(s)
                  </div>
                </div>
              </div>
              <div class="ba-browser-actions">
                <button class="ba-btn-icon" data-action="create-page" data-browser="${browser.browserId}" title="Create Page">
                  <i data-lucide="file-plus"></i>
                </button>
                <button class="ba-btn-icon" data-action="close-browser" data-browser="${browser.browserId}" title="Close Browser">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `;
        }

        browsersList.innerHTML = html;

        // Add event listeners
        browsersList.querySelectorAll('[data-action="create-page"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const browserId = (e.currentTarget as HTMLElement).getAttribute('data-browser');
            if (browserId) this.createPage(browserId);
          });
        });

        browsersList.querySelectorAll('[data-action="close-browser"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const browserId = (e.currentTarget as HTMLElement).getAttribute('data-browser');
            if (browserId) this.closeBrowser(browserId);
          });
        });

        // Initialize icons
        if ((window as any).lucide) {
          (window as any).lucide.createIcons();
        }
      } else {
        browsersList.innerHTML = `<div class="ba-error">${this.escapeHtml(result.output)}</div>`;
      }
    } catch (error: any) {
      browsersList.innerHTML = `<div class="ba-error">Error: ${this.escapeHtml(error.message)}</div>`;
    }
  }

  /**
   * Refresh pages list
   */
  private async refreshPages(): Promise<void> {
    const pagesList = document.getElementById('ba-pages-list');
    if (!pagesList) return;

    try {
      const result = await clayPuppeteerIntegration.listPages();
      
      if (result.success) {
        this.pages = result.pages;
        
        if (this.pages.length === 0) {
          pagesList.innerHTML = '<div class="ba-empty">No pages open</div>';
          return;
        }

        let html = '';
        for (const page of this.pages) {
          html += `
            <div class="ba-page-item">
              <div class="ba-page-info">
                <div class="ba-page-icon">
                  <i data-lucide="file-text"></i>
                </div>
                <div class="ba-page-details">
                  <div class="ba-page-title">${this.escapeHtml(page.title || 'Untitled')}</div>
                  <div class="ba-page-url">${this.escapeHtml(page.url || 'about:blank')}</div>
                  <div class="ba-page-id">${this.escapeHtml(page.pageId)}</div>
                </div>
              </div>
              <div class="ba-page-actions">
                <button class="ba-btn-icon" data-action="screenshot" data-page="${page.pageId}" title="Screenshot">
                  <i data-lucide="camera"></i>
                </button>
                <button class="ba-btn-icon" data-action="close-page" data-page="${page.pageId}" title="Close Page">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `;
        }

        pagesList.innerHTML = html;

        // Add event listeners
        pagesList.querySelectorAll('[data-action="screenshot"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const pageId = (e.currentTarget as HTMLElement).getAttribute('data-page');
            if (pageId) this.takeScreenshot(pageId);
          });
        });

        pagesList.querySelectorAll('[data-action="close-page"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const pageId = (e.currentTarget as HTMLElement).getAttribute('data-page');
            if (pageId) this.closePage(pageId);
          });
        });

        // Initialize icons
        if ((window as any).lucide) {
          (window as any).lucide.createIcons();
        }
      } else {
        pagesList.innerHTML = `<div class="ba-error">${this.escapeHtml(result.output)}</div>`;
      }
    } catch (error: any) {
      pagesList.innerHTML = `<div class="ba-error">Error: ${this.escapeHtml(error.message)}</div>`;
    }
  }

  /**
   * Create a new page
   */
  private async createPage(browserId: string): Promise<void> {
    try {
      notificationManager.info('Creating page...');
      const result = await clayPuppeteerIntegration.createPage(browserId);
      
      if (result.success) {
        notificationManager.success(`Page created: ${result.pageId}`);
        await this.refresh();
      } else {
        notificationManager.error(result.output);
      }
    } catch (error: any) {
      notificationManager.error(`Failed to create page: ${error.message}`);
    }
  }

  /**
   * Close a browser
   */
  private async closeBrowser(browserId: string): Promise<void> {
    if (!confirm(`Close browser ${browserId}?`)) {
      return;
    }

    try {
      notificationManager.info('Closing browser...');
      const result = await clayPuppeteerIntegration.closeBrowser(browserId);
      
      if (result.success) {
        notificationManager.success('Browser closed');
        await this.refresh();
      } else {
        notificationManager.error(result.output);
      }
    } catch (error: any) {
      notificationManager.error(`Failed to close browser: ${error.message}`);
    }
  }

  /**
   * Close a page
   */
  private async closePage(pageId: string): Promise<void> {
    try {
      notificationManager.info('Closing page...');
      const result = await clayPuppeteerIntegration.closePage(pageId);
      
      if (result.success) {
        notificationManager.success('Page closed');
        await this.refresh();
      } else {
        notificationManager.error(result.output);
      }
    } catch (error: any) {
      notificationManager.error(`Failed to close page: ${error.message}`);
    }
  }

  /**
   * Take a screenshot
   */
  private async takeScreenshot(pageId: string): Promise<void> {
    try {
      notificationManager.info('Taking screenshot...');
      const result = await clayPuppeteerIntegration.screenshot(pageId);
      
      if (result.success && result.screenshot) {
        // Create download link
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${result.screenshot}`;
        link.download = `screenshot-${pageId}-${Date.now()}.png`;
        link.click();
        
        notificationManager.success('Screenshot downloaded');
      } else {
        notificationManager.error(result.output);
      }
    } catch (error: any) {
      notificationManager.error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Start auto-refresh
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => {
      if (this.isVisible) {
        this.refresh();
      }
    }, 5000); // Refresh every 5 seconds
  }

  /**
   * Stop auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
export const browserAutomation = new BrowserAutomation();

