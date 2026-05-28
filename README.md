# Screen-looper

Electron + React + TypeScript desktop app that plays all videos in a selected folder, loops continuously, and updates live when files are added/removed. The interface keeps a large live preview front-and-center with the playlist as a side panel.

Previously released as **Video Folder Loop Player** (versions ≤ 1.0.9). Existing installs continue to receive updates automatically.

## Security checks

Run audit checks locally:

```bash
npm run audit:prod
npm run audit:full
```

- `audit:prod` fails the pipeline on high/critical production dependency vulnerabilities.
- `audit:full` checks runtime + dev dependencies at moderate and above.

## Docker for local parity + CI/CD

### Build, typecheck, and audit in Docker

```bash
docker compose run --rm app-ci
docker compose run --rm app-build
```

### With corporate proxy/filtered internet

Set env vars before running:

```bash
export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=http://proxy:8080
export NO_PROXY=localhost,127.0.0.1
# optional internal registry
export NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
```

Then run compose commands again.

## Local development

```bash
npm install
npm run dev
```

## Windows installer, portable app, and auto-update

Build both Windows release formats:

```bash
npm run dist:win
```

The generated files are written to `release-artifacts/`:

- `Screen-looper-Setup-<version>-x64.exe` is the recommended installer. This build supports automatic updates.
- `Screen-looper-Portable-<version>-x64.exe` can be copied to another Windows computer, but should be updated manually by replacing it with a newer portable build.

Automatic updates are published through GitHub Releases. To publish a new update, create a release branch whose version matches `package.json`:

```bash
git switch staging
npm version 1.0.1 --no-git-tag-version
git add package.json package-lock.json
git commit -m "Prepare release 1.0.1"
git switch -c release/1.0.1
git push -u origin release/1.0.1
```

The `Release` GitHub Actions workflow validates the branch, builds the Windows installer, portable executable, and update metadata, creates the tag, and publishes the GitHub Release. Users who installed the setup version will receive updates from the matching GitHub release.

Installed builds check for updates shortly after startup, every 15 minutes while open, and when Windows resumes from sleep. Downloaded updates are installed when the user restarts the app.

## Git strategy and releases

This repo uses `staging` for QA, `main` for production source, and `release/x.y.z` branches for app releases. See [docs/git-strategy.md](docs/git-strategy.md) for the full workflow and required GitHub branch protection settings.
