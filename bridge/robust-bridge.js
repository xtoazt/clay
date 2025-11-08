#!/usr/bin/env node

/**
 * Robust Bridge Server - Enhanced with comprehensive error handling
 * This is a wrapper that ensures the bridge always works
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the actual bridge
let bridgeServer = null;

async function startRobustBridge() {
  console.log('🛡️  Starting Robust Bridge Server...');

  // Try to import and start the bridge
  try {
    // Dynamic import with error handling
    const bridgeModule = await import('./bridge.js');
    
    // If bridge exports a start function, call it
    if (bridgeModule.default && typeof bridgeModule.default === 'function') {
      bridgeServer = await bridgeModule.default();
    } else {
      // Bridge starts automatically when imported
      console.log('✅ Bridge module loaded');
    }
  } catch (error) {
    console.error('❌ Failed to load bridge module:', error.message);
    
    // Fallback: spawn as separate process
    console.log('🔄 Attempting to start bridge as separate process...');
    const bridgePath = path.join(__dirname, 'bridge.js');
    const bridgeProcess = spawn('node', [bridgePath], {
      cwd: __dirname,
      stdio: 'inherit',
      detached: false
    });

    bridgeProcess.on('error', (err) => {
      console.error('❌ Bridge process error:', err);
      // Retry after delay
      setTimeout(() => startRobustBridge(), 5000);
    });

    bridgeProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`⚠️  Bridge process exited with code ${code}`);
        // Restart after delay
        setTimeout(() => startRobustBridge(), 5000);
      }
    });

    bridgeServer = bridgeProcess;
  }

  // Health check
  setInterval(async () => {
    try {
      const healthy = await checkHealth();
      if (!healthy && bridgeServer) {
        console.log('⚠️  Bridge health check failed, restarting...');
        if (bridgeServer.kill) {
          bridgeServer.kill();
        }
        setTimeout(() => startRobustBridge(), 2000);
      }
    } catch (error) {
      console.error('Health check error:', error.message);
    }
  }, 10000);
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8765/api/health', { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (bridgeServer && bridgeServer.kill) {
    bridgeServer.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (bridgeServer && bridgeServer.kill) {
    bridgeServer.kill();
  }
  process.exit(0);
});

// Start
startRobustBridge();

