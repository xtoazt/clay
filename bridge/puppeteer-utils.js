/**
 * Puppeteer Utilities
 * Advanced web automation, analysis, and monitoring tools
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export class PuppeteerUtils {
  /**
   * Analyze web page performance
   */
  static async analyzePerformance(page) {
    try {
      const metrics = await page.metrics();
      const performanceTiming = await page.evaluate(() => {
        const perf = window.performance.timing;
        return {
          dns: perf.domainLookupEnd - perf.domainLookupStart,
          tcp: perf.connectEnd - perf.connectStart,
          request: perf.responseStart - perf.requestStart,
          response: perf.responseEnd - perf.responseStart,
          dom: perf.domComplete - perf.domLoading,
          load: perf.loadEventEnd - perf.navigationStart
        };
      });

      const lighthouse = await page.evaluate(() => {
        if (window.performance && window.performance.getEntriesByType) {
          const nav = window.performance.getEntriesByType('navigation')[0];
          const paint = window.performance.getEntriesByType('paint');
          return {
            domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            load: nav.loadEventEnd - nav.loadEventStart,
            firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
            firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
          };
        }
        return {};
      });

      return {
        success: true,
        metrics: {
          ...metrics,
          ...performanceTiming,
          ...lighthouse
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract SEO data from page
   */
  static async extractSEO(page) {
    try {
      const seo = await page.evaluate(() => {
        const getMeta = (name) => {
          const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return meta ? meta.getAttribute('content') : null;
        };

        return {
          title: document.title,
          description: getMeta('description') || getMeta('og:description'),
          keywords: getMeta('keywords'),
          ogTitle: getMeta('og:title'),
          ogImage: getMeta('og:image'),
          ogType: getMeta('og:type'),
          canonical: document.querySelector('link[rel="canonical"]')?.href || null,
          h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
          h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
          images: Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            alt: img.alt,
            title: img.title
          })),
          links: Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.href,
            text: a.textContent.trim()
          }))
        };
      });

      return { success: true, seo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test accessibility
   */
  static async testAccessibility(page) {
    try {
      const accessibility = await page.evaluate(() => {
        const issues = [];
        
        // Check images without alt text
        document.querySelectorAll('img').forEach(img => {
          if (!img.alt && !img.getAttribute('aria-label')) {
            issues.push({
              type: 'missing-alt',
              element: 'img',
              message: 'Image missing alt text',
              selector: img.src || 'unknown'
            });
          }
        });

        // Check links without text
        document.querySelectorAll('a').forEach(link => {
          if (!link.textContent.trim() && !link.getAttribute('aria-label')) {
            issues.push({
              type: 'empty-link',
              element: 'a',
              message: 'Link without text content',
              href: link.href
            });
          }
        });

        // Check form inputs without labels
        document.querySelectorAll('input, textarea, select').forEach(input => {
          const id = input.id;
          const label = id ? document.querySelector(`label[for="${id}"]`) : null;
          const ariaLabel = input.getAttribute('aria-label');
          const placeholder = input.getAttribute('placeholder');
          
          if (!label && !ariaLabel && !placeholder) {
            issues.push({
              type: 'missing-label',
              element: input.tagName.toLowerCase(),
              message: 'Form input without label',
              type: input.type
            });
          }
        });

        // Check heading hierarchy
        let lastLevel = 0;
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
          const level = parseInt(heading.tagName.charAt(1));
          if (level > lastLevel + 1) {
            issues.push({
              type: 'heading-skip',
              element: heading.tagName.toLowerCase(),
              message: `Heading level skipped from ${lastLevel} to ${level}`,
              text: heading.textContent.trim()
            });
          }
          lastLevel = level;
        });

        return {
          issues,
          score: issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 10))
        };
      });

      return { success: true, accessibility };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract structured data from page
   */
  static async extractStructuredData(page) {
    try {
      const data = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const structured = scripts.map(script => {
          try {
            return JSON.parse(script.textContent);
          } catch (e) {
            return null;
          }
        }).filter(Boolean);

        return structured;
      });

      return { success: true, structuredData: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Monitor network requests
   */
  static async monitorNetwork(page) {
    try {
      const requests = [];
      const responses = [];
      const failures = [];

      page.on('request', (request) => {
        requests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          timestamp: Date.now()
        });
      });

      page.on('response', (response) => {
        responses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          timestamp: Date.now()
        });
      });

      page.on('requestfailed', (request) => {
        failures.push({
          url: request.url(),
          failureText: request.failure()?.errorText || 'Unknown',
          timestamp: Date.now()
        });
      });

      return {
        success: true,
        requests,
        responses,
        failures
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract content from page
   */
  static async extractContent(page, options = {}) {
    try {
      const content = await page.evaluate((opts) => {
        const extract = {
          text: '',
          headings: [],
          paragraphs: [],
          lists: [],
          tables: [],
          code: []
        };

        // Extract main text
        const main = document.querySelector('main, article, [role="main"]') || document.body;
        extract.text = main.innerText || main.textContent || '';

        // Extract headings
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
          document.querySelectorAll(tag).forEach(heading => {
            extract.headings.push({
              level: parseInt(tag.charAt(1)),
              text: heading.textContent.trim()
            });
          });
        });

        // Extract paragraphs
        document.querySelectorAll('p').forEach(p => {
          const text = p.textContent.trim();
          if (text) extract.paragraphs.push(text);
        });

        // Extract lists
        document.querySelectorAll('ul, ol').forEach(list => {
          const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim());
          extract.lists.push({
            type: list.tagName.toLowerCase(),
            items
          });
        });

        // Extract tables
        document.querySelectorAll('table').forEach(table => {
          const rows = Array.from(table.querySelectorAll('tr')).map(tr => {
            return Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent.trim());
          });
          extract.tables.push(rows);
        });

        // Extract code blocks
        document.querySelectorAll('pre code, code').forEach(code => {
          extract.code.push({
            language: code.className.match(/language-(\w+)/)?.[1] || 'unknown',
            code: code.textContent
          });
        });

        return extract;
      }, options);

      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Compare two screenshots
   */
  static async compareScreenshots(screenshot1, screenshot2) {
    try {
      // Simple pixel comparison (for production, use image-diff library)
      const buffer1 = Buffer.from(screenshot1, 'base64');
      const buffer2 = Buffer.from(screenshot2, 'base64');
      
      if (buffer1.length !== buffer2.length) {
        return {
          success: true,
          match: false,
          difference: 'Different image sizes'
        };
      }

      let differences = 0;
      for (let i = 0; i < buffer1.length; i++) {
        if (buffer1[i] !== buffer2[i]) {
          differences++;
        }
      }

      const similarity = ((buffer1.length - differences) / buffer1.length) * 100;

      return {
        success: true,
        match: similarity > 95,
        similarity: similarity.toFixed(2),
        differences
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate page report
   */
  static async generateReport(page, url) {
    try {
      const [performance, seo, accessibility, structuredData, content] = await Promise.all([
        this.analyzePerformance(page),
        this.extractSEO(page),
        this.testAccessibility(page),
        this.extractStructuredData(page),
        this.extractContent(page)
      ]);

      return {
        success: true,
        url,
        timestamp: new Date().toISOString(),
        performance: performance.metrics || {},
        seo: seo.seo || {},
        accessibility: accessibility.accessibility || {},
        structuredData: structuredData.structuredData || [],
        content: content.content || {}
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Scrape data from page with selectors
   */
  static async scrape(page, selectors) {
    try {
      const data = await page.evaluate((sel) => {
        const result = {};
        
        for (const [key, selector] of Object.entries(sel)) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 1) {
              result[key] = elements[0].textContent.trim();
            } else if (elements.length > 1) {
              result[key] = Array.from(elements).map(el => el.textContent.trim());
            } else {
              result[key] = null;
            }
          } catch (e) {
            result[key] = null;
          }
        }
        
        return result;
      }, selectors);

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for specific conditions
   */
  static async waitForCondition(page, condition, timeout = 30000) {
    try {
      await page.waitForFunction(condition, { timeout });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill form automatically
   */
  static async fillForm(page, formData) {
    try {
      await page.evaluate((data) => {
        for (const [selector, value] of Object.entries(data)) {
          const element = document.querySelector(selector);
          if (element) {
            if (element.tagName === 'SELECT') {
              element.value = value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (element.type === 'checkbox' || element.type === 'radio') {
              if (value) element.checked = true;
            } else {
              element.value = value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
      }, formData);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

