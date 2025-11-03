# 🚀 Quick Start - Deploy in 60 Seconds

## For Web Terminal (PWA)

### Step 1: Enable GitHub Pages
1. Go to your repository → **Settings** → **Pages**
2. Under **Source**, select **"GitHub Actions"**
3. Click **Save**

### Step 2: Push to Main
```bash
git add .
git commit -m "Deploy web terminal"
git push origin main
```

### Step 3: Done! 🎉
- Check the **Actions** tab to see deployment progress
- Visit: `https://YOUR_USERNAME.github.io/clay/`
- Install on Chromebook: Click "Install" button!

## For Electron App Releases

### Step 1: Create a Release
1. Go to **Releases** → **Create a new release**
2. Tag: `v1.0.0`
3. Title: `Release v1.0.0`
4. Click **"Publish release"**

### Step 2: Download Builds
- GitHub Actions builds automatically
- Download from the release page
- Distribute to users!

## That's It!

No configuration needed. The workflows handle everything automatically.

For more details, see [DEPLOYMENT.md](DEPLOYMENT.md)

