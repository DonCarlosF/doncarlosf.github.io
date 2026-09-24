'use strict';
/*
 * TeachTown Runner for Mac. A window around the same Home page as
 * `npm run ui`. The Playwright runner is unchanged: this process only
 * starts ui-server.js and talks to the page through the menu.
 *
 * Unsigned on purpose. Code signing and notarization are out of scope.
 * Build the .app on the MacBook with `npm run mac:build`.
 */
const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { menuTemplate } = require('./menu');

const ROOT = path.join(__dirname, '..');
let server = null;
let win = null;
let serverUrl = null;

function send(cmd) {
  if (win && !win.isDestroyed()) win.webContents.send('tt-command', cmd);
}

function installMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        onStart(subject) {
          send({ type: 'start', subject });
        },
        onToggleDryRun() {
          send({ type: 'dry-run' });
        },
        onOpenSettings() {
          send({ type: 'settings' });
        },
        onQuit() {
          app.quit();
        },
      })
    )
  );
}

function startServer() {
  // process.execPath is the Electron binary. ELECTRON_RUN_AS_NODE makes
  // the child run ui-server.js as plain Node.
  server = spawn(process.execPath, [path.join(ROOT, 'ui-server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      TT_UI_NO_OPEN: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  const watch = (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    buf += text;
    if (buf.length > 8000) buf = buf.slice(-4000);
    const match = buf.match(/Serving on (http:\/\/127\.0\.0\.1:\d+\/)/);
    if (match && !serverUrl) {
      serverUrl = match[1];
      if (win && !win.isDestroyed()) win.loadURL(serverUrl);
    }
  };
  server.stdout.on('data', watch);
  server.stderr.on('data', watch);
  server.on('exit', () => {
    server = null;
  });
}

function stopServer() {
  if (!server) return;
  try {
    server.kill('SIGTERM');
  } catch {
    /* already gone */
  }
  server = null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    title: 'TeachTown Runner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (serverUrl) win.loadURL(serverUrl);
  else {
    win.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<title>TeachTown Runner</title><p style="font:20px system-ui;padding:28px">Opening TeachTown Runner…</p>'
        )
    );
  }
}

app.whenReady().then(() => {
  installMenu();
  startServer();
  createWindow();
});

app.on('before-quit', () => {
  stopServer();
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});
