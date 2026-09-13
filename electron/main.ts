import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string;
  customName: string;
  privateLink?: string;
}

interface StoreData {
  sessions: SessionEntry[];
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
        return JSON.parse(raw) as StoreData;
      }
    } catch {
      // Corrupted file — reset
    }
    return { sessions: [] };
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
}

// ── Globals ─────────────────────────────────────────────────────────────────

const BLOX_FRUITS_URL = 'https://www.roblox.com/games/2753915549/Blox-Fruits';
const ROBLOX_HOME_URL = 'https://www.roblox.com/home';
let mainWindow: BrowserWindow | null = null;
let store: JsonStore;

// Track open session windows to prevent duplicates
const openWindows = new Map<string, BrowserWindow>();

// ── Helpers ─────────────────────────────────────────────────────────────────

const isDev = !app.isPackaged;

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

/**
 * Determine which URL to open based on the session name.
 * If the name starts with "Bloxy" (case-insensitive), open Blox Fruits.
 * Otherwise, open the Roblox home page.
 */
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
    backgroundColor: '#030712', // gray-950
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
  // If already open, focus it and navigate to the new URL
  const existing = openWindows.get(sessionId);
  if (existing && !existing.isDestroyed()) {
    existing.loadURL(url);
    existing.focus();
    return;
  }

  // Create a partition-isolated session
  const partition = `persist:session_${sessionId}`;
  const ses = session.fromPartition(partition);

  // Set a standard Chrome user-agent so Roblox doesn't block the embedded browser
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

  // Handle new-window navigations (e.g. target="_blank") — open in same window
  win.webContents.setWindowOpenHandler(({ url }) => {
    win.loadURL(url);
    return { action: 'deny' };
  });

  win.loadURL(url);

  openWindows.set(sessionId, win);

  win.on('closed', () => {
    openWindows.delete(sessionId);
  });
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Get all saved sessions
  ipcMain.handle('sessions:get', (): SessionEntry[] => {
    return store.getSessions();
  });

  // Add a new session
  ipcMain.handle('sessions:add', (_event, entry: SessionEntry): SessionEntry[] => {
    const sessions = store.getSessions();
    sessions.push(entry);
    store.setSessions(sessions);
    return sessions;
  });

  // Remove a session
  ipcMain.handle('sessions:remove', (_event, sessionId: string): SessionEntry[] => {
    const sessions = store.getSessions().filter((s) => s.id !== sessionId);
    store.setSessions(sessions);

    // Close the window if open
    const win = openWindows.get(sessionId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    openWindows.delete(sessionId);

    return sessions;
  });

  // Rename a session
  ipcMain.handle(
    'sessions:rename',
    (_event, sessionId: string, newName: string): SessionEntry[] => {
      const sessions = store.getSessions();
      const target = sessions.find((s) => s.id === sessionId);
      if (target) {
        target.customName = newName;
        store.setSessions(sessions);
      }
      return sessions;
    }
  );

  // Reorder a session (move up or down)
  ipcMain.handle(
    'sessions:reorder',
    (_event, sessionId: string, direction: 'up' | 'down'): SessionEntry[] => {
      const sessions = store.getSessions();
      const index = sessions.findIndex((s) => s.id === sessionId);
      if (index === -1) return sessions;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sessions.length) return sessions;

      // Swap
      [sessions[index], sessions[newIndex]] = [sessions[newIndex], sessions[index]];
      store.setSessions(sessions);
      return sessions;
    }
  );

  // Set private link for a session
  ipcMain.handle(
    'sessions:setPrivateLink',
    (_event, sessionId: string, link: string): SessionEntry[] => {
      const sessions = store.getSessions();
      const target = sessions.find((s) => s.id === sessionId);
      if (target) {
        target.privateLink = link || undefined;
        store.setSessions(sessions);
      }
      return sessions;
    }
  );

  // Open an isolated browser window for a session (auto-detects URL from name)
  ipcMain.handle('sessions:open', (_event, sessionId: string, customName: string): void => {
    const url = getUrlForSession(customName);
    openSessionWindow(sessionId, customName, url);
  });

  // Open an isolated browser window with the private server link
  ipcMain.handle('sessions:openPrivate', (_event, sessionId: string, customName: string, privateLink: string): void => {
    openSessionWindow(sessionId, customName, privateLink);
  });
}

// ── App Lifecycle ───────────────────────────────────────────────────────────

app.setName('Bloxfruit Manager');

app.whenReady().then(() => {
  store = new JsonStore();
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
