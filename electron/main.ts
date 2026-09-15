import { app, BrowserWindow, ipcMain, session, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, execSync, ChildProcess } from 'child_process';


// ── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string;
  customName: string;
  privateLink?: string;
}

interface StoreData {
  sessions: SessionEntry[];
  multiLoadEnabled: boolean;
  globalPrivateLink: string;
}

// ── Simple JSON Store ───────────────────────────────────────────────────────

class JsonStore {
  private filePath: string;
  private data: StoreData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'sessions.json');
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.multiLoadEnabled === undefined) parsed.multiLoadEnabled = false;
        if (parsed.globalPrivateLink === undefined) parsed.globalPrivateLink = '';
        return parsed as StoreData;
      }
    } catch {
      // Corrupted file — reset
    }
    return { sessions: [], multiLoadEnabled: false, globalPrivateLink: '' };
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getSessions(): SessionEntry[] {
    return this.data.sessions;
  }

  setSessions(sessions: SessionEntry[]): void {
    this.data.sessions = sessions;
    this.save();
  }

  getMultiLoadEnabled(): boolean {
    return this.data.multiLoadEnabled;
  }

  setMultiLoadEnabled(enabled: boolean): void {
    this.data.multiLoadEnabled = enabled;
    this.save();
  }

  getGlobalPrivateLink(): string {
    return this.data.globalPrivateLink;
  }

  setGlobalPrivateLink(link: string): void {
    this.data.globalPrivateLink = link;
    this.save();
  }
}

// ── Globals ─────────────────────────────────────────────────────────────────

const BLOX_FRUITS_URL = 'https://www.roblox.com/games/2753915549/Blox-Fruits';
const ROBLOX_HOME_URL = 'https://www.roblox.com/home';
let mainWindow: BrowserWindow | null = null;
let store: JsonStore;

// Track open session windows to prevent duplicates
const openWindows = new Map<string, BrowserWindow>();

// ── Windows Multi-Instance Logic ────────────────────────────────────────────

const multiLockPath = path.join(process.env.LOCALAPPDATA || '', 'BloxFruitManager');
const multiLockFile = path.join(multiLockPath, 'multi.lock');

function stopWindowsMultiInstance() {
  if (fs.existsSync(multiLockFile)) {
    try {
      fs.unlinkSync(multiLockFile);
    } catch (e) {
      console.error('Failed to delete lock file:', e);
    }
  }
}

function startWindowsMultiInstance() {
  if (process.platform !== 'win32') return;
  stopWindowsMultiInstance();

  try {
    const tasklist = execSync('tasklist /FI "IMAGENAME eq RobloxPlayerBeta.exe" /NH', { encoding: 'utf8' });
    if (tasklist.includes('RobloxPlayerBeta.exe')) {
      const response = dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Close Roblox',
        message: 'Roblox must be closed to enable Multi Load. Should we close it now?',
        buttons: ['Yes', 'No']
      });
      if (response === 0) {
        execSync('taskkill /F /IM RobloxPlayerBeta.exe /T');
      }
    }
  } catch (e) {}

  const isPackaged = app.isPackaged;
  const basePath = isPackaged ? process.resourcesPath : app.getAppPath();
  const exePath = path.join(basePath, isPackaged ? 'MultiRoblox' : 'resources/MultiRoblox', 'BloxFruitManager-Multi.exe');
  
  if (fs.existsSync(exePath)) {
    if (!fs.existsSync(multiLockPath)) fs.mkdirSync(multiLockPath, { recursive: true });
    fs.writeFileSync(multiLockFile, 'lock');
    
    shell.openPath(exePath).then((error) => {
      if (error) {
        console.error('[MultiLoad] Failed to start BloxFruitManager-Multi.exe:', error);
      } else {
        console.log('[MultiLoad] Windows invisible MultiRoblox app started');
      }
    });
  } else {
    console.error('[MultiLoad] Could not find BloxFruitManager-Multi.exe at', exePath);
  }
}

// ── Launch Logic ───────────────────────────────────────────────

function handleRobloxLaunch(targetUrl: string, sessionId: string): boolean {
  if (targetUrl.startsWith('roblox-player://') || targetUrl.startsWith('roblox://')) {
    if (store.getMultiLoadEnabled() && process.platform === 'win32') {
      console.log(`[MultiLoad] Launching Roblox (Windows multi-instance active) for session: ${sessionId}`);
      shell.openExternal(targetUrl);
    } else {
      shell.openExternal(targetUrl);
    }
    return true;
  }
  return false;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const isDev = !app.isPackaged;

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function getUrlForSession(customName: string): string {
  return customName.toLowerCase().startsWith('bloxy')
    ? BLOX_FRUITS_URL
    : ROBLOX_HOME_URL;
}

// ── Main Window ─────────────────────────────────────────────────────────────

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 680,
    minWidth: 420,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#030712',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Session Browser Window ──────────────────────────────────────────────────

function openSessionWindow(sessionId: string, customName: string, url: string): void {
  const existing = openWindows.get(sessionId);
  if (existing && !existing.isDestroyed()) {
    existing.loadURL(url);
    existing.focus();
    return;
  }

  const partition = `persist:session_${sessionId}`;
  const ses = session.fromPartition(partition);

  ses.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: `Bloxfruit Manager — ${customName}`,
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (handleRobloxLaunch(url, sessionId)) {
      return { action: 'deny' };
    }
    win.loadURL(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (handleRobloxLaunch(targetUrl, sessionId)) {
      event.preventDefault();
    }
  });

  win.webContents.on('will-redirect', (event, targetUrl) => {
    if (handleRobloxLaunch(targetUrl, sessionId)) {
      event.preventDefault();
    }
  });

  win.webContents.on('will-frame-navigate', (event) => {
    if (handleRobloxLaunch(event.url, sessionId)) {
      event.preventDefault();
    }
  });

  win.loadURL(url);

  openWindows.set(sessionId, win);

  win.on('closed', () => {
    openWindows.delete(sessionId);
  });
}

// ── Avatar Fetching ──────────────────────────────────────────────────────────

async function fetchSessionAvatar(sessionId: string): Promise<string | null> {
  try {
    const partition = `persist:session_${sessionId}`;
    const ses = session.fromPartition(partition);
    const cookies = await ses.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
    
    if (!cookies || cookies.length === 0) return null; // Not logged in
    
    const cookieVal = cookies[0].value;
    
    // 1. Get User ID from authenticated session
    const authRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { Cookie: `.ROBLOSECURITY=${cookieVal}` }
    });
    
    if (!authRes.ok) return null;
    
    const authData = await authRes.json();
    const userId = authData.id;
    if (!userId) return null;
    
    // 2. Get Avatar Headshot (Circular 150x150 Png)
    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`);
    if (!thumbRes.ok) return null;
    
    const thumbData = await thumbRes.json();
    if (thumbData?.data && thumbData.data.length > 0) {
      return thumbData.data[0].imageUrl;
    }
  } catch (err) {
    console.error(`[Avatar] Failed to fetch avatar for session ${sessionId}:`, err);
  }
  return null;
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('sessions:get', (): SessionEntry[] => {
    return store.getSessions();
  });

  ipcMain.handle('sessions:getAvatar', async (_event, sessionId: string): Promise<string | null> => {
    return await fetchSessionAvatar(sessionId);
  });

  ipcMain.handle('sessions:add', (_event, entry: SessionEntry): SessionEntry[] => {
    const sessions = store.getSessions();
    sessions.push(entry);
    store.setSessions(sessions);
    return sessions;
  });

  ipcMain.handle('sessions:remove', (_event, sessionId: string): SessionEntry[] => {
    const sessions = store.getSessions().filter((s) => s.id !== sessionId);
    store.setSessions(sessions);

    const win = openWindows.get(sessionId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    openWindows.delete(sessionId);
    
    return sessions;
  });

  ipcMain.handle('sessions:rename', (_event, sessionId: string, newName: string): SessionEntry[] => {
      const sessions = store.getSessions();
      const target = sessions.find((s) => s.id === sessionId);
      if (target) {
        target.customName = newName;
        store.setSessions(sessions);
      }
      return sessions;
  });

  ipcMain.handle('sessions:reorder', (_event, sessionId: string, direction: 'up' | 'down'): SessionEntry[] => {
      const sessions = store.getSessions();
      const index = sessions.findIndex((s) => s.id === sessionId);
      if (index === -1) return sessions;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sessions.length) return sessions;

      [sessions[index], sessions[newIndex]] = [sessions[newIndex], sessions[index]];
      store.setSessions(sessions);
      return sessions;
  });

  ipcMain.handle('sessions:open', (_event, sessionId: string, customName: string): void => {
    const url = getUrlForSession(customName);
    openSessionWindow(sessionId, customName, url);
  });

  ipcMain.handle('sessions:openPrivate', (_event, sessionId: string, customName: string, privateLink: string): void => {
    openSessionWindow(sessionId, customName, privateLink);
  });

  ipcMain.handle('multiload:getStatus', () => {
    return store.getMultiLoadEnabled();
  });

  ipcMain.handle('multiload:toggle', (_event, enabled: boolean) => {
    store.setMultiLoadEnabled(enabled);
    if (enabled) {
      startWindowsMultiInstance();
    } else {
      stopWindowsMultiInstance();
    }
    return enabled;
  });

  ipcMain.handle('settings:getPrivateLink', () => {
    return store.getGlobalPrivateLink();
  });

  ipcMain.handle('settings:setPrivateLink', (_event, link: string) => {
    store.setGlobalPrivateLink(link);
    return link;
  });

  ipcMain.handle('app:exportData', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No main window' };

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Sessions & Tokens',
      defaultPath: 'bloxfruit_manager_backup.bfm',
      filters: [{ name: 'BloxFruit Manager Backup', extensions: ['bfm', 'json'] }]
    });

    if (canceled || !filePath) return { success: false, error: 'Canceled' };

    try {
      const dataToExport = {
        store: store.getSessions(),
        multiLoadEnabled: store.getMultiLoadEnabled(),
        globalPrivateLink: store.getGlobalPrivateLink(),
        cookies: {} as Record<string, string>
      };

      for (const sessionEntry of dataToExport.store) {
        const partition = `persist:session_${sessionEntry.id}`;
        const ses = session.fromPartition(partition);
        const cookies = await ses.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
        if (cookies && cookies.length > 0) {
          dataToExport.cookies[sessionEntry.id] = cookies[0].value;
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(dataToExport, null, 2), 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:importData', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No main window' };

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import Sessions & Tokens',
      properties: ['openFile'],
      filters: [{ name: 'BloxFruit Manager Backup', extensions: ['bfm', 'json'] }]
    });

    if (canceled || filePaths.length === 0) return { success: false, error: 'Canceled' };

    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      const importedData = JSON.parse(raw);

      if (importedData.store) {
        store.setSessions(importedData.store);
      }
      if (importedData.multiLoadEnabled !== undefined) {
        store.setMultiLoadEnabled(importedData.multiLoadEnabled);
      }
      if (importedData.globalPrivateLink !== undefined) {
        store.setGlobalPrivateLink(importedData.globalPrivateLink);
      }

      if (importedData.cookies) {
        for (const [sessionId, cookieValue] of Object.entries(importedData.cookies)) {
          const partition = `persist:session_${sessionId}`;
          const ses = session.fromPartition(partition);
          await ses.cookies.set({
            url: 'https://www.roblox.com',
            name: '.ROBLOSECURITY',
            value: cookieValue as string,
            domain: '.roblox.com',
            path: '/',
            secure: true,
            httpOnly: true
          });
        }
      }
      
      return { success: true, sessions: store.getSessions(), multiLoadEnabled: store.getMultiLoadEnabled(), globalPrivateLink: store.getGlobalPrivateLink() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

// ── App Lifecycle ───────────────────────────────────────────────────────────

app.setName('Bloxfruit Manager');

app.whenReady().then(() => {
  store = new JsonStore();

  if (store.getMultiLoadEnabled()) {
    startWindowsMultiInstance();
  }

  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopWindowsMultiInstance();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  stopWindowsMultiInstance();
});
