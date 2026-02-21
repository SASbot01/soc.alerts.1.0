const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blackwolf', {
  connectToServer: (url) => ipcRenderer.invoke('connect-to-server', url),
  getSavedServers: () => ipcRenderer.invoke('get-saved-servers'),
  removeSavedServer: (url) => ipcRenderer.invoke('remove-saved-server', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  setAcceptSelfSigned: (accept) => ipcRenderer.invoke('set-accept-self-signed', accept),
  getAcceptSelfSigned: () => ipcRenderer.invoke('get-accept-self-signed'),
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (_event, status) => callback(status));
  }
});
