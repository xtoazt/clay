# Deployment Guide for Clay Terminal

This guide explains how to deploy Clay Terminal using GitHub Actions.

## 🚀 Quick Start

### For Web Terminal (PWA)

1. **Enable GitHub Pages:**
   - Go to your repository Settings → Pages
   - Source: Select "GitHub Actions"
   - Save

2. **Push to main branch:**
   ```bash
   git push origin main
   ```
   The web terminal will automatically deploy to GitHub Pages!

3. **Access your terminal:**
   - URL: `https://yourusername.github.io/clay/`

### For Electron App Releases

1. **Create a release:**
   - Go to your repository → Releases → Create a new release
   - Tag: `v1.0.0` (or any version)
   - Title: `Release v1.0.0`
   - Click "Publish release"

2. **Automatically builds:**
   - GitHub Actions will build for macOS, Linux, and Windows
   - Artifacts will be attached to the release
   - Download and distribute!

## 📋 Available Workflows

### 1. CI - Build and Test (`ci.yml`)
- **Triggers:** Push, Pull Requests
- **What it does:**
  - Builds TypeScript on all platforms
  - Runs type checking
  - Verifies build output
  - Uploads build artifacts

**Usage:** Runs automatically on every push/PR

### 2. Deploy Web Terminal (`deploy-web.yml`)
- **Triggers:** Push to main (web changes), Manual dispatch
- **What it does:**
  - Builds the web terminal (PWA)
  - Deploys to GitHub Pages
  - Makes it installable on Chromebooks

**Usage:** 
```bash
# Automatic on push to main
git push origin main

# Or manually trigger from Actions tab
```

### 3. Build Electron App (`build-electron.yml`)
- **Triggers:** Release creation, Tag push (v*), Manual dispatch
- **What it does:**
  - Builds distributable packages for all platforms
  - Creates .tar.gz (Linux/macOS) and .zip (Windows)
  - Attaches to GitHub Release

**Usage:**
```bash
# Create a release on GitHub, or:
git tag v1.0.0
git push origin v1.0.0
```

## 🎯 Step-by-Step Deployment

### Option 1: Web Terminal (Recommended for Chromebooks)

1. **Enable GitHub Pages:**
   ```
   Repository → Settings → Pages
   Source: GitHub Actions
   ```

2. **Push your code:**
   ```bash
   git add .
   git commit -m "Deploy web terminal"
   git push origin main
   ```

3. **Wait for deployment:**
   - Check Actions tab
   - Wait for "Deploy Web Terminal" to complete
   - Visit: `https://yourusername.github.io/clay/`

4. **Install on Chromebook:**
   - Open the URL in Chrome
   - Click "Install" button in address bar
   - Or use the Install button in the app

### Option 2: Electron Desktop App

1. **Create a release:**
   - Go to GitHub → Releases → "Draft a new release"
   - Tag: `v1.0.0`
   - Title: `Release v1.0.0`
   - Description: (optional)
   - Click "Publish release"

2. **Download builds:**
   - GitHub Actions will build automatically
   - Go to the release page
   - Download the artifacts for your platform

## 🔧 Configuration

### GitHub Pages Settings
- **Branch:** `main` (or `master`)
- **Source:** GitHub Actions
- **Custom domain:** (optional)

### Secrets (Optional)
No secrets required! The workflows use `GITHUB_TOKEN` automatically.

## 📦 What Gets Built

### Web Terminal
- **Location:** `web/dist/`
- **Output:** Deployed to GitHub Pages
- **Features:** PWA, installable, offline-capable

### Electron App
- **macOS:** `.tar.gz` archive
- **Linux:** `.tar.gz` archive  
- **Windows:** `.zip` archive

## 🐛 Troubleshooting

### Web Terminal not deploying?
- Check GitHub Pages is enabled
- Verify workflow ran successfully
- Check repository Settings → Pages

### Electron builds failing?
- Ensure `package-lock.json` is committed
- Check Node.js version compatibility
- Review workflow logs in Actions tab

### Build artifacts not appearing?
- Check retention period (7-30 days)
- Verify workflow completed successfully
- Check Actions tab for errors

## 🎉 That's It!

Your terminal is now deployable with one push! The workflows handle everything automatically.

