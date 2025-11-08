# Robust Bridge Server

The Clay Terminal Bridge server is designed to **always work** - it's the backbone of the entire application. This document explains the robustness features.

## 🛡️ Robustness Features

### 1. **Bridge Manager** (`bridge-manager.js`)
- **Auto-restart**: Automatically restarts the bridge if it crashes
- **Health monitoring**: Continuously checks bridge health every 5 seconds
- **Smart recovery**: Detects failures and restarts automatically
- **Max restart attempts**: Prevents infinite restart loops
- **Graceful shutdown**: Properly cleans up on exit

### 2. **Enhanced Error Handling**
- **Try-catch blocks**: All critical operations wrapped in error handling
- **Graceful degradation**: Server continues running even if some features fail
- **Error logging**: Comprehensive error logging without crashing
- **Port conflict resolution**: Automatically handles port conflicts

### 3. **Health Monitoring**
- **Health check endpoint**: `/api/health` provides detailed status
- **Automatic recovery**: Detects unhealthy state and restarts
- **Resource monitoring**: Tracks memory usage and active sessions

### 4. **Process Management**
- **Service installation**: Can be installed as system service
- **Auto-start on boot**: Starts automatically when system boots
- **Keep-alive**: System service keeps bridge running

## 🚀 Usage

### Start with Manager (Recommended)
```bash
npm run manager
```

This starts the bridge manager which ensures the bridge always runs.

### Start Directly
```bash
npm start
```

### Start Robust Wrapper
```bash
npm run robust
```

### Install as Service
```bash
npm run install-service
```

This installs the bridge manager as a system service that:
- Starts automatically on boot
- Restarts automatically if it crashes
- Runs in the background

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 8765)
- `HOST`: Server host (default: 127.0.0.1)

### Health Check Settings
- **Interval**: 5 seconds (configurable in `bridge-manager.js`)
- **Max failures**: 3 consecutive failures trigger restart
- **Max restart attempts**: 10 attempts before longer delay

## 📊 Health Check Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "platform": "linux",
  "pid": 12345,
  "uptime": 3600,
  "memory": {
    "used": 50,
    "total": 100,
    "rss": 150
  },
  "activeSessions": 2,
  "services": {
    "websocket": true,
    "rest": true,
    "puppeteer": true
  }
}
```

## 🐛 Troubleshooting

### Bridge Keeps Restarting
1. Check logs: `tail -f ~/Library/Logs/clay-bridge.log` (macOS) or `journalctl -u clay-bridge` (Linux)
2. Check port availability: `lsof -i :8765`
3. Check dependencies: `npm install` in bridge directory

### Port Already in Use
The bridge automatically tries to free the port. If it fails:
```bash
# Find process using port
lsof -i :8765

# Kill it (replace PID)
kill -9 <PID>
```

### Service Not Starting
1. Check service status: `systemctl status clay-bridge` (Linux)
2. Check logs: `journalctl -u clay-bridge -n 50`
3. Reload service: `sudo systemctl daemon-reload`

## 🔒 Reliability Guarantees

1. **Always Running**: Bridge manager ensures bridge is always running
2. **Auto-Recovery**: Automatic restart on crashes or failures
3. **Health Monitoring**: Continuous health checks and recovery
4. **Error Isolation**: Errors in one feature don't crash the entire server
5. **Resource Management**: Proper cleanup of resources on shutdown

## 📝 Best Practices

1. **Use Bridge Manager**: Always use `npm run manager` for production
2. **Install as Service**: Use `npm run install-service` for auto-start
3. **Monitor Logs**: Regularly check logs for issues
4. **Health Checks**: Monitor `/api/health` endpoint
5. **Resource Limits**: Monitor memory usage via health endpoint

