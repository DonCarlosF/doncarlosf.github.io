'use strict';
/*
 * Bridge from the Mac menu to the Home page. The page cannot see Node,
 * the filesystem, or the runner. It only receives plain commands:
 *   { type: 'start', subject: 'math' }
 *   { type: 'dry-run' }
 *   { type: 'settings' }
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ttDesktop', {
  listen(handler) {
    if (typeof handler !== 'function') return;
    ipcRenderer.on('tt-command', (_event, cmd) => handler(cmd));
  },
});
