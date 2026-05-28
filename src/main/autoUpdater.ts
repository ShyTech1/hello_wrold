import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron';
import { autoUpdater } from 'electron-updater';

const initialUpdateCheckDelayMs = 3000;
const periodicUpdateCheckIntervalMs = 15 * 60 * 1000;

let updateCheckStarted = false;
let updateCheckInProgress = false;
let updateDownloadInProgress = false;
let updateDownloaded = false;
let updatePromptOpen = false;
let updateCheckTimer: NodeJS.Timeout | undefined;

function getDialogWindow(preferredWindow: BrowserWindow): BrowserWindow | undefined {
  if (!preferredWindow.isDestroyed()) {
    return preferredWindow;
  }

  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
}

export function startAutoUpdates(window: BrowserWindow): void {
  if (updateCheckStarted) {
    return;
  }

  const isPortableBuild = Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR);

  if (!app.isPackaged || isPortableBuild) {
    ipcMain.handle('checkForUpdates', async () => {
      return { status: 'unavailable', reason: isPortableBuild ? 'portable' : 'dev' };
    });
    return;
  }

  updateCheckStarted = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  const checkForUpdates = (): void => {
    if (updateCheckInProgress || updateDownloadInProgress || updateDownloaded) {
      return;
    }

    updateCheckInProgress = true;

    void autoUpdater
      .checkForUpdates()
      .catch((error) => {
        console.error('Auto-update check failed:', error);
      })
      .finally(() => {
        updateCheckInProgress = false;
      });
  };

  autoUpdater.on('update-available', () => {
    updateDownloadInProgress = true;
  });

  autoUpdater.on('update-not-available', () => {
    updateDownloadInProgress = false;
  });

  autoUpdater.on('error', (error) => {
    updateDownloadInProgress = false;
    console.error('Auto-update failed:', error);
  });

  autoUpdater.on('update-downloaded', () => {
    updateDownloadInProgress = false;
    updateDownloaded = true;

    if (updatePromptOpen) {
      return;
    }

    updatePromptOpen = true;

    const dialogWindow = getDialogWindow(window);
    const dialogOptions: Electron.MessageBoxOptions = {
      type: 'info',
      title: 'Update ready',
      message: 'A new version is ready to install.',
      detail: 'Restart Screen-looper to finish updating.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1
    };

    const updatePrompt = dialogWindow
      ? dialog.showMessageBox(dialogWindow, dialogOptions)
      : dialog.showMessageBox(dialogOptions);

    void updatePrompt
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .finally(() => {
        updatePromptOpen = false;
      });
  });

  ipcMain.handle('checkForUpdates', async () => {
    if (updateDownloaded) {
      return { status: 'ready' };
    }
    checkForUpdates();
    return { status: 'checking' };
  });

  setTimeout(checkForUpdates, initialUpdateCheckDelayMs);
  updateCheckTimer = setInterval(checkForUpdates, periodicUpdateCheckIntervalMs);
  updateCheckTimer.unref();

  powerMonitor.on('resume', checkForUpdates);

  app.once('before-quit', () => {
    if (updateCheckTimer) {
      clearInterval(updateCheckTimer);
      updateCheckTimer = undefined;
    }

    powerMonitor.off('resume', checkForUpdates);
  });
}
