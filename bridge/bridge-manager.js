#!/usr/bin/env node

/**
 * Bridge Manager - Ensures bridge server always runs
 * Auto-restart, health monitoring, and error recovery
 */

import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BRIDGE_PORT = process.env.PORT || 8765;
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}/api/health`;
const HEALTH_CHECK_INTERVAL = 5000; // Check every 5 seconds
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_DELAY = 2000; // 2 seconds between restarts

class BridgeManager {
  constructor() {
    this.bridgeProcess = null;
    this.restartCount = 0;
    this.healthCheckInterval = null;
    this.isShuttingDown = false;
    this.lastHealthCheck = null;
    this.consecutiveFailures = 0;
  }

  /**
   * Check if bridge is running and healthy
   */
  async checkHealth() {
    return new Promise((resolve) => {
      const req = http.get(BRIDGE_URL, { timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            resolve(health.status === 'ok');
          } catch {
            resolve(res.statusCode === 200);
          }
        });
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Start the bridge server
   */
  async startBridge() {
    if (this.isShuttingDown) {
      return;
    }

    // Check if already running
    const isHealthy = await this.checkHealth();
    if (isHealthy) {
      console.log('✅ Bridge already running and healthy');
      this.consecutiveFailures = 0;
      return;
    }

    // Kill any existing process
    if (this.bridgeProcess) {
      try {
        this.bridgeProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // Ignore
      }
    }

    console.log(`🚀 Starting Clay Terminal Bridge (attempt ${this.restartCount + 1})...`);

    const bridgePath = path.join(__dirname, 'bridge.js');
    
    // Check if bridge.js exists
    if (!fs.existsSync(bridgePath)) {
      console.error(`❌ Bridge file not found: ${bridgePath}`);
      this.scheduleRestart();
      return;
    }

    try {
      this.bridgeProcess = spawn('node', [bridgePath], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: {
          ...process.env,
          PORT: BRIDGE_PORT.toString()
        }
      });

      // Log output
      this.bridgeProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[Bridge] ${output}`);
        }
      });

      this.bridgeProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output && !output.includes('DeprecationWarning')) {
          console.error(`[Bridge Error] ${output}`);
        }
      });

      this.bridgeProcess.on('error', (error) => {
        console.error('❌ Failed to start bridge process:', error.message);
        this.consecutiveFailures++;
        this.scheduleRestart();
      });

      this.bridgeProcess.on('exit', (code, signal) => {
        if (this.isShuttingDown) {
          return;
        }

        console.log(`⚠️  Bridge process exited with code ${code}, signal ${signal}`);
        this.bridgeProcess = null;
        this.consecutiveFailures++;
        this.scheduleRestart();
      });

      // Wait a bit and verify it started
      setTimeout(async () => {
        const healthy = await this.checkHealth();
        if (healthy) {
          console.log('✅ Bridge started successfully');
          console.log(`📡 Listening on http://127.0.0.1:${BRIDGE_PORT}`);
          this.restartCount = 0;
          this.consecutiveFailures = 0;
        } else {
          console.log('⏳ Bridge starting... (will verify in next health check)');
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Error starting bridge:', error.message);
      this.consecutiveFailures++;
      this.scheduleRestart();
    }
  }

  /**
   * Schedule a restart
   */
  scheduleRestart() {
    if (this.isShuttingDown) {
      return;
    }

    this.restartCount++;

    if (this.restartCount > MAX_RESTART_ATTEMPTS) {
      console.error(`❌ Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Waiting before retrying...`);
      this.restartCount = 0;
      // Wait longer before retrying
      setTimeout(() => this.startBridge(), RESTART_DELAY * 10);
      return;
    }

    console.log(`🔄 Scheduling restart in ${RESTART_DELAY}ms...`);
    setTimeout(() => this.startBridge(), RESTART_DELAY);
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      const isHealthy = await this.checkHealth();
      this.lastHealthCheck = Date.now();

      if (!isHealthy) {
        this.consecutiveFailures++;
        console.log(`⚠️  Bridge health check failed (${this.consecutiveFailures} consecutive failures)`);
        
        if (this.consecutiveFailures >= 3) {
          console.log('🔄 Bridge appears unhealthy, restarting...');
          this.consecutiveFailures = 0;
          await this.startBridge();
        }
      } else {
        this.consecutiveFailures = 0;
      }
    }, HEALTH_CHECK_INTERVAL);

    console.log('💓 Health monitoring started');
  }

  /**
   * Stop the bridge manager
   */
  async stop() {
    console.log('\n🛑 Stopping Bridge Manager...');
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.bridgeProcess) {
      console.log('🛑 Stopping bridge process...');
      try {
        this.bridgeProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (this.bridgeProcess) {
              this.bridgeProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          if (this.bridgeProcess) {
            this.bridgeProcess.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
      } catch (e) {
        console.error('Error stopping bridge:', e.message);
      }
    }

    console.log('✅ Bridge Manager stopped');
  }

  /**
   * Start the manager
   */
  async start() {
    console.log('🎯 Clay Terminal Bridge Manager');
    console.log('================================\n');
    console.log(`📡 Port: ${BRIDGE_PORT}`);
    console.log(`💓 Health check interval: ${HEALTH_CHECK_INTERVAL}ms`);
    console.log(`🔄 Max restart attempts: ${MAX_RESTART_ATTEMPTS}\n`);

    // Start the bridge
    await this.startBridge();

    // Start health monitoring
    this.startHealthMonitoring();

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.stop();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      // Don't exit, try to recover
      this.scheduleRestart();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      // Don't exit, try to recover
    });
  }
}

// Start the manager
const manager = new BridgeManager();
manager.start().catch((error) => {
  console.error('❌ Failed to start Bridge Manager:', error);
  process.exit(1);
});

