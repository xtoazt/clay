#!/usr/bin/env node

// Install Clay Terminal Bridge as a system service
// This allows it to auto-start when the system boots

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLATFORM = process.platform;

async function installService() {
  console.log('🔧 Installing Clay Terminal Bridge as system service...\n');

  try {
    if (PLATFORM === 'darwin') {
      // macOS - Create LaunchAgent
      await installMacOSService();
    } else if (PLATFORM === 'linux') {
      // Linux - Create systemd service
      await installLinuxService();
    } else if (PLATFORM === 'win32') {
      // Windows - Create task scheduler entry
      await installWindowsService();
    } else {
      console.log('❌ Unsupported platform:', PLATFORM);
      process.exit(1);
    }

    console.log('\n✅ Service installed successfully!');
    console.log('📝 The bridge will start automatically on system boot.');
    console.log('💡 To start it now, run: npm start');
  } catch (error) {
    console.error('❌ Failed to install service:', error.message);
    process.exit(1);
  }
}

async function installMacOSService() {
  const homeDir = os.homedir();
  const launchAgentsDir = path.join(homeDir, 'Library', 'LaunchAgents');
  const plistPath = path.join(launchAgentsDir, 'com.clay.terminal.bridge.plist');
  
  // Ensure LaunchAgents directory exists
  await fs.promises.mkdir(launchAgentsDir, { recursive: true });
  
  const nodePath = process.execPath;
  const bridgePath = path.join(__dirname, 'bridge.js');
  
  const bridgeManagerPath = path.join(__dirname, 'bridge-manager.js');
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.clay.terminal.bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${bridgeManagerPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
  </dict>
  <key>StandardOutPath</key>
  <string>${homeDir}/Library/Logs/clay-bridge.log</string>
  <key>StandardErrorPath</key>
  <string>${homeDir}/Library/Logs/clay-bridge.error.log</string>
</dict>
</plist>`;

  await fs.promises.writeFile(plistPath, plistContent);
  
  // Load the service
  try {
    await execAsync(`launchctl load ${plistPath}`);
    console.log('✅ macOS LaunchAgent installed and loaded');
  } catch (e) {
    console.log('⚠️  LaunchAgent created but not loaded. Run: launchctl load', plistPath);
  }
}

async function installLinuxService() {
  const serviceContent = `[Unit]
Description=Clay Terminal Bridge - Robust Server
After=network.target

[Service]
Type=simple
User=${os.userInfo().username}
WorkingDirectory=${__dirname}
ExecStart=${process.execPath} ${path.join(__dirname, 'bridge-manager.js')}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
# Ensure service always runs
StartLimitInterval=0
StartLimitBurst=0

[Install]
WantedBy=multi-user.target`;

  const servicePath = '/etc/systemd/system/clay-bridge.service';
  
  console.log('⚠️  This requires sudo privileges.');
  console.log('Creating service file...');
  
  // Write to temp file first
  const tempPath = path.join(__dirname, 'clay-bridge.service');
  await fs.promises.writeFile(tempPath, serviceContent);
  
  console.log(`\n📝 Service file created at: ${tempPath}`);
  console.log('📋 To complete installation, run:');
  console.log(`   sudo cp ${tempPath} ${servicePath}`);
  console.log('   sudo systemctl daemon-reload');
  console.log('   sudo systemctl enable clay-bridge');
  console.log('   sudo systemctl start clay-bridge');
}

async function installWindowsService() {
  const bridgePath = path.join(__dirname, 'bridge.js');
  const nodePath = process.execPath;
  
  // Create a batch file to run the bridge
  const batPath = path.join(__dirname, 'start-bridge.bat');
  const batContent = `@echo off
cd /d "${__dirname}"
"${nodePath}" "${bridgePath}"
`;

  await fs.promises.writeFile(batPath, batContent);
  
  console.log('⚠️  Windows service installation requires additional setup.');
  console.log('📝 Batch file created at:', batPath);
  console.log('📋 You can:');
  console.log('   1. Add it to Startup folder (Win+R, type shell:startup)');
  console.log('   2. Use Task Scheduler to run it at startup');
  console.log('   3. Use a tool like NSSM to create a Windows service');
}

installService();

