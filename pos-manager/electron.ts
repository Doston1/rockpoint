// electron.ts
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // Load Vite dev server in development
    win.loadURL('http://localhost:5173');
  } else {
    // Load bundled app in production
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, recreate a window if the app is reactivated and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps usually stay open unless the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
