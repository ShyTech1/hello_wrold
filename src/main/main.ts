import { app, BrowserWindow, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startAutoUpdates } from './autoUpdater';
import { registerIpcHandlers } from './ipcHandlers';

const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
const videoProtocolPrefix = 'local-video://file/';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
]);

function registerVideoProtocol(): void {
  protocol.handle('local-video', (request) => {
    const encodedPath = request.url.slice(videoProtocolPrefix.length);
    const fileUrl = pathToFileURL(decodeURIComponent(encodedPath)).toString();
    return net.fetch(fileUrl, {
      method: request.method,
      headers: request.headers
    });
  });
}

function createWindow(): BrowserWindow {
  // In packaged builds the .exe icon (baked in by electron-builder from build/icon.ico)
  // drives the taskbar entry, so only set BrowserWindow.icon during dev runs.
  const devIconPath = app.isPackaged ? undefined : path.join(__dirname, '../../build/icon.png');

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Screen-looper',
    backgroundColor: '#0f1117',
    ...(devIconPath ? { icon: devIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (!app.isPackaged) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  registerIpcHandlers(window);
  return window;
}

app.whenReady().then(() => {
  registerVideoProtocol();
  const window = createWindow();
  startAutoUpdates(window);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow();
      startAutoUpdates(window);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
