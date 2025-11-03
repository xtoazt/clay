# GitHub Actions Workflows

This repository includes automated workflows for building, testing, and deploying Clay Terminal.

## 📋 Available Workflows

### 1. **CI - Build and Test** (`ci.yml`)
- **Triggers:** Every push and pull request
- **What it does:**
  - ✅ Builds TypeScript on all platforms (Linux, macOS, Windows)
  - ✅ Runs type checking
  - ✅ Verifies build output
  - ✅ Uploads build artifacts
- **Runs automatically** - No action needed!

### 2. **Deploy Web Terminal** (`deploy-web.yml`)
- **Triggers:** Push to main branch
- **What it does:**
  - ✅ Builds the web terminal (PWA)
  - ✅ Deploys to GitHub Pages
  - ✅ Makes it installable on Chromebooks
- **Setup required:** Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)
- **Result:** Live at `https://yourusername.github.io/clay/`

### 3. **Build Electron App** (`build-electron.yml`)
- **Triggers:** 
  - Creating a GitHub release
  - Pushing a tag starting with `v*` (e.g., `v1.0.0`)
  - Manual dispatch
- **What it does:**
  - ✅ Builds distributable packages for macOS, Linux, Windows
  - ✅ Creates `.tar.gz` (Linux/macOS) and `.zip` (Windows)
  - ✅ Attaches artifacts to GitHub Release
- **Result:** Downloadable packages in the release

## 🎯 Quick Setup

### For Web Terminal:
```bash
# 1. Enable GitHub Pages (one-time setup)
# Go to: Settings → Pages → Source: GitHub Actions

# 2. Push your code
git push origin main

# 3. Done! Terminal is live.
```

### For Electron Releases:
```bash
# 1. Create a release on GitHub
# Or tag your commit:
git tag v1.0.0
git push origin v1.0.0

# 2. Download builds from the release page
```

## 🔍 Monitoring Workflows

- **View status:** Go to the **Actions** tab in your repository
- **Check logs:** Click on any workflow run to see detailed logs
- **Debug failures:** All workflows include error handling and clear error messages

## ⚙️ Configuration

All workflows are **zero-configuration** - they work out of the box!

- **No secrets required** - Uses `GITHUB_TOKEN` automatically
- **No environment setup** - Handles Node.js, dependencies automatically
- **No manual steps** - Fully automated

## 🚨 Troubleshooting

### Workflow not running?
- Check that workflows are enabled in repository Settings → Actions
- Ensure you're pushing to the correct branch (`main` or `master`)

### Build failing?
- Check that `package-lock.json` is committed
- Review workflow logs in the Actions tab
- Verify Node.js version compatibility

### Deployment not working?
- For web: Ensure GitHub Pages is enabled and set to "GitHub Actions"
- For releases: Check that you have permission to create releases

## 📚 More Information

- **Quick Start:** [QUICK_START.md](QUICK_START.md)
- **Full Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **GitHub Actions Docs:** https://docs.github.com/en/actions

