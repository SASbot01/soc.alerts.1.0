// ═══════════════════════════════════════════════════════════════
//  BlackWolf SOC — Desktop Client (Electron Main Process)
// ═══════════════════════════════════════════════════════════════

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  shell,
  net
} = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// ─── Globals ─────────────────────────────────────────────────

let store;
let mainWindow = null;
let connectWindow = null;
let tray = null;
let currentServerUrl = null;
let connectionCheckInterval = null;
let isQuitting = false;

// ─── Config Store ────────────────────────────────────────────
// Simple JSON-based persistent config (no external dependencies)

class ConfigStore {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch {
      return { servers: [], lastServer: null, acceptSelfSigned: false };
    }
  }

  _save() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  get(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
  }

  addServer(url) {
    const servers = this.get('servers', []);
    const filtered = servers.filter(s => s !== url);
    filtered.unshift(url);
    if (filtered.length > 10) filtered.pop();
    this.set('servers', filtered);
    this.set('lastServer', url);
  }

  removeServer(url) {
    const servers = this.get('servers', []);
    this.set('servers', servers.filter(s => s !== url));
    if (this.get('lastServer') === url) {
      this.set('lastServer', null);
    }
  }
}

// ─── PNG Fallback Icon ───────────────────────────────────────
// Generates a minimal PNG at runtime if no icon files exist

function generateFallbackPng(size) {
  function crc32(buf) {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (~crc) >>> 0;
  }

  function chunk(type, data) {
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, c]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(size * rowLen);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.45;
  const innerR = size * 0.35;

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const off = y * rowLen + 1 + x * 4;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= outerR && d >= innerR) {
        // Amber ring
        raw[off] = 245; raw[off + 1] = 158; raw[off + 2] = 11; raw[off + 3] = 255;
      } else if (d < innerR) {
        // Dark fill
        raw[off] = 15; raw[off + 1] = 15; raw[off + 2] = 26; raw[off + 3] = 255;
      }
      // else: transparent (already zeroed)
    }
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ─── Icon Helpers ────────────────────────────────────────────

function getIconPath() {
  const candidates = [
    path.join(__dirname, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    path.join(__dirname, 'icons', 'icon.png')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getTrayIcon() {
  // Try shipped tray icon first
  const trayPath = path.join(__dirname, 'icons', 'tray-icon.png');
  if (fs.existsSync(trayPath)) {
    return nativeImage.createFromPath(trayPath).resize({ width: 16, height: 16 });
  }

  // Try main icon
  const iconPath = getIconPath();
  if (iconPath) {
    return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  }

  // Generate fallback PNG at runtime
  const fallbackDir = path.join(app.getPath('userData'), 'icons');
  const fallbackPath = path.join(fallbackDir, 'tray.png');

  if (!fs.existsSync(fallbackPath)) {
    if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(fallbackPath, generateFallbackPng(32));
  }

  return nativeImage.createFromPath(fallbackPath).resize({ width: 16, height: 16 });
}

// ─── URL Utilities ───────────────────────────────────────────

function normalizeUrl(url) {
  url = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

async function checkServerHealth(url) {
  return new Promise((resolve) => {
    try {
      const request = net.request({ url, method: 'HEAD', redirect: 'follow' });

      const timeout = setTimeout(() => {
        request.abort();
        resolve(false);
      }, 8000);

      request.on('response', (response) => {
        clearTimeout(timeout);
        resolve(response.statusCode < 500);
      });

      request.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      request.end();
    } catch {
      resolve(false);
    }
  });
}

// ─── Connect Window ──────────────────────────────────────────

function createConnectWindow() {
  if (connectWindow) {
    connectWindow.focus();
    return;
  }

  const iconPath = getIconPath();

  connectWindow = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'BlackWolf SOC — Connect',
    icon: iconPath || undefined,
    backgroundColor: '#0a0a12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  connectWindow.setMenuBarVisibility(false);
  connectWindow.loadFile('connect.html');

  connectWindow.on('closed', () => {
    connectWindow = null;
    if (!mainWindow) {
      app.quit();
    }
  });
}

// ─── Main Window ─────────────────────────────────────────────

function createMainWindow(serverUrl) {
  if (mainWindow) {
    mainWindow.loadURL(serverUrl);
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'BlackWolf SOC',
    icon: iconPath || undefined,
    backgroundColor: '#0a0a12',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:blackwolf-soc'
    }
  });

  // ── Menu ──

  const isMac = process.platform === 'darwin';

  const menuTemplate = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Change Server', click: () => showConnectWindow() },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'View',
      submenu: [
        { label: 'Refresh', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.webContents.reload() },
        { label: 'Force Refresh', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: 'Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow && mainWindow.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Server',
      submenu: [
        { label: 'Change Server', click: () => showConnectWindow() },
        { type: 'separator' },
        ...(!isMac ? [{ label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } }] : [])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  mainWindow.setMenu(menu);

  if (!isMac) {
    mainWindow.setAutoHideMenuBar(true);
  }

  // ── Load server URL ──

  mainWindow.loadURL(serverUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (connectWindow) {
      connectWindow.close();
    }
  });

  // ── Navigation control: keep user on the SOC domain ──

  const serverOrigin = new URL(serverUrl).origin;

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== serverOrigin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── Connection lost handling ──

  mainWindow.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode === -3) return; // Aborted — ignore
    injectOfflineOverlay();
  });

  // ── Minimize to tray instead of closing ──

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopConnectionMonitor();
  });

  // ── Start monitoring ──

  startConnectionMonitor(serverUrl);
}

function showConnectWindow() {
  stopConnectionMonitor();
  currentServerUrl = null;

  if (mainWindow) {
    isQuitting = true;
    mainWindow.close();
    mainWindow = null;
    isQuitting = false;
  }

  createConnectWindow();
}

// ─── System Tray ─────────────────────────────────────────────

function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('BlackWolf SOC');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open BlackWolf SOC',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else if (currentServerUrl) {
          createMainWindow(currentServerUrl);
        } else {
          createConnectWindow();
        }
      }
    },
    { type: 'separator' },
    { label: 'Change Server', click: () => showConnectWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── Connection Monitor ──────────────────────────────────────

function startConnectionMonitor(serverUrl) {
  stopConnectionMonitor();

  connectionCheckInterval = setInterval(async () => {
    if (!mainWindow) return;
    const healthy = await checkServerHealth(serverUrl);
    if (!healthy) {
      injectOfflineOverlay();
    }
  }, 30000);
}

function stopConnectionMonitor() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
}

function injectOfflineOverlay() {
  if (!mainWindow) return;

  mainWindow.webContents.executeJavaScript(`
    if (!document.getElementById('blackwolf-offline-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'blackwolf-offline-overlay';
      overlay.innerHTML = \`
        <div style="
          position: fixed; inset: 0; z-index: 99999;
          background: rgba(10, 10, 18, 0.95);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #e2e8f0;
        ">
          <div style="
            width: 48px; height: 48px; border: 3px solid #334155;
            border-top-color: #f59e0b; border-radius: 50%;
            animation: bw-spin 1s linear infinite;
            margin-bottom: 24px;
          "></div>
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600;">Connection Lost</h2>
          <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px;">
            Attempting to reconnect to the server...
          </p>
          <button onclick="document.getElementById('blackwolf-offline-overlay').remove(); location.reload();" style="
            background: #f59e0b; color: #0a0a12; border: none;
            padding: 10px 28px; border-radius: 8px; font-size: 14px;
            font-weight: 600; cursor: pointer;
          ">Retry Now</button>
        </div>
        <style>@keyframes bw-spin { to { transform: rotate(360deg); } }</style>
      \`;
      document.body.appendChild(overlay);
    }
  `).catch(() => {});
}

// ─── IPC Handlers ────────────────────────────────────────────

function setupIpcHandlers() {
  ipcMain.handle('connect-to-server', async (_event, url) => {
    try {
      url = normalizeUrl(url);
      new URL(url); // Validate format

      const healthy = await checkServerHealth(url);
      if (!healthy) {
        return {
          success: false,
          error: 'Could not reach the server. Check the URL and ensure the platform is running.'
        };
      }

      store.addServer(url);
      currentServerUrl = url;
      createMainWindow(url);
      return { success: true };
    } catch {
      return { success: false, error: 'Invalid URL format.' };
    }
  });

  ipcMain.handle('get-saved-servers', async () => {
    return {
      servers: store.get('servers', []),
      lastServer: store.get('lastServer', null)
    };
  });

  ipcMain.handle('remove-saved-server', async (_event, url) => {
    store.removeServer(url);
    return { success: true };
  });

  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('set-accept-self-signed', async (_event, accept) => {
    store.set('acceptSelfSigned', !!accept);
    return { success: true };
  });

  ipcMain.handle('get-accept-self-signed', async () => {
    return store.get('acceptSelfSigned', false);
  });
}

// ─── App Lifecycle ───────────────────────────────────────────

// Handle certificate errors (self-signed certs)
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  if (store && store.get('acceptSelfSigned', false)) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.whenReady().then(() => {
  store = new ConfigStore();
  setupIpcHandlers();
  createTray();

  const lastServer = store.get('lastServer', null);
  if (lastServer) {
    currentServerUrl = lastServer;
    createMainWindow(lastServer);
  } else {
    createConnectWindow();
  }

  app.on('activate', () => {
    if (!mainWindow && !connectWindow) {
      if (currentServerUrl) {
        createMainWindow(currentServerUrl);
      } else {
        createConnectWindow();
      }
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit — tray keeps the app alive
    // User must explicitly quit via tray menu
  }
});
