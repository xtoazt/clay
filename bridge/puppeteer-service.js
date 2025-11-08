/**
 * Puppeteer Service
 * Browser automation service using Puppeteer
 * https://github.com/puppeteer/puppeteer
 */

import puppeteer from 'puppeteer';
import { PuppeteerUtils } from './puppeteer-utils.js';

class PuppeteerService {
  constructor() {
    this.browsers = new Map(); // Map of browserId -> browser instance
    this.pages = new Map(); // Map of pageId -> page instance
    this.nextBrowserId = 1;
    this.nextPageId = 1;
  }

  /**
   * Launch a new browser instance
   */
  async launchBrowser(options = {}) {
    try {
      const browserId = `browser_${this.nextBrowserId++}`;
      
      const launchOptions = {
        headless: options.headless !== false,
        args: options.args || [],
        defaultViewport: options.viewport || { width: 1280, height: 720 },
        ...options
      };

      const browser = await puppeteer.launch(launchOptions);
      this.browsers.set(browserId, browser);

      // Handle browser close
      browser.on('disconnected', () => {
        this.browsers.delete(browserId);
        // Clean up pages
        const pagesToDelete = [];
        for (const [pageId, page] of this.pages.entries()) {
          try {
            if (page.browser() === browser) {
              pagesToDelete.push(pageId);
            }
          } catch (e) {
            // Page might be closed, delete it
            pagesToDelete.push(pageId);
          }
        }
        pagesToDelete.forEach(id => this.pages.delete(id));
      });

      return {
        success: true,
        browserId,
        version: await browser.version(),
        wsEndpoint: browser.wsEndpoint()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close a browser instance
   */
  async closeBrowser(browserId) {
    try {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        return { success: false, error: 'Browser not found' };
      }

      await browser.close();
      this.browsers.delete(browserId);

      // Clean up pages
      for (const [pageId, page] of this.pages.entries()) {
        if (page.browser() === browser) {
          this.pages.delete(pageId);
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new page
   */
  async createPage(browserId) {
    try {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        return { success: false, error: 'Browser not found' };
      }

      const page = await browser.newPage();
      const pageId = `page_${this.nextPageId++}`;
      this.pages.set(pageId, page);

      return {
        success: true,
        pageId,
        url: page.url()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(pageId, url, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const response = await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || 30000,
        ...options
      });

      return {
        success: true,
        url: page.url(),
        status: response?.status(),
        title: await page.title()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get page content
   */
  async getContent(pageId) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const content = await page.content();
      const title = await page.title();
      const url = page.url();

      return {
        success: true,
        content,
        title,
        url
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(pageId, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const screenshot = await page.screenshot({
        type: options.type || 'png',
        fullPage: options.fullPage || false,
        ...options
      });

      return {
        success: true,
        screenshot: screenshot.toString('base64'),
        format: options.type || 'png'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Evaluate JavaScript on the page
   */
  async evaluate(pageId, script, ...args) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const result = await page.evaluate(script, ...args);

      return {
        success: true,
        result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Click an element
   */
  async click(pageId, selector, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.click(selector, options);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Type text into an element
   */
  async type(pageId, selector, text, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.type(selector, text, options);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for selector
   */
  async waitForSelector(pageId, selector, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.waitForSelector(selector, options);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get element text
   */
  async getText(pageId, selector) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const text = await page.$eval(selector, el => el.textContent);

      return {
        success: true,
        text
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all browsers
   */
  listBrowsers() {
    const browsers = [];
    for (const [browserId, browser] of this.browsers.entries()) {
      browsers.push({
        browserId,
        connected: browser.isConnected(),
        pages: Array.from(this.pages.entries())
          .filter(([_, page]) => page.browser() === browser)
          .map(([pageId]) => pageId)
      });
    }
    return browsers;
  }

  /**
   * List all pages
   */
  async listPages() {
    const pages = [];
    for (const [pageId, page] of this.pages.entries()) {
      try {
        const url = page.url();
        const title = await page.title().catch(() => 'Loading...');
        pages.push({
          pageId,
          url,
          title
        });
      } catch (e) {
        // Page might be closed
        pages.push({
          pageId,
          url: 'closed',
          title: 'Closed'
        });
      }
    }
    return pages;
  }

  /**
   * Close a page
   */
  async closePage(pageId) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      await page.close();
      this.pages.delete(pageId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get page PDF
   */
  async pdf(pageId, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const pdf = await page.pdf({
        format: options.format || 'A4',
        ...options
      });

      return {
        success: true,
        pdf: pdf.toString('base64'),
        format: 'pdf'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze page performance
   */
  async analyzePerformance(pageId) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      const result = await PuppeteerUtils.analyzePerformance(page);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract SEO data
   */
  async extractSEO(pageId) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.extractSEO(page);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test accessibility
   */
  async testAccessibility(pageId) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.testAccessibility(page);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract structured data
   */
  async extractStructuredData(pageId) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.extractStructuredData(page);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract content
   */
  async extractContent(pageId, options = {}) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.extractContent(page, options);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Scrape data with selectors
   */
  async scrape(pageId, selectors) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.scrape(page, selectors);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill form
   */
  async fillForm(pageId, formData) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.fillForm(page, formData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(pageId, url) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.generateReport(page, url || page.url());
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for condition
   */
  async waitForCondition(pageId, condition, timeout = 30000) {
    try {
      const page = this.pages.get(pageId);
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      return await PuppeteerUtils.waitForCondition(page, condition, timeout);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup all browsers
   */
  async cleanup() {
    const promises = [];
    for (const [browserId, browser] of this.browsers.entries()) {
      promises.push(browser.close());
    }
    await Promise.all(promises);
    this.browsers.clear();
    this.pages.clear();
  }
}

// Export singleton instance
export const puppeteerService = new PuppeteerService();

