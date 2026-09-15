import { contextBridge, ipcRenderer } from 'electron';

export interface SessionEntry {
  id: string;
  customName: string;
  privateLink?: string;
}

export interface ElectronAPI {
  sessions: {
    getAll: () => Promise<SessionEntry[]>;
    add: (entry: SessionEntry) => Promise<SessionEntry[]>;
    remove: (sessionId: string) => Promise<SessionEntry[]>;
    rename: (sessionId: string, newName: string) => Promise<SessionEntry[]>;
    reorder: (sessionId: string, direction: 'up' | 'down') => Promise<SessionEntry[]>;
    open: (sessionId: string, customName: string) => Promise<void>;
    openPrivate: (sessionId: string, customName: string, privateLink: string) => Promise<void>;
    getAvatar: (sessionId: string) => Promise<string | null>;
  };
  multiLoad: {
    getStatus: () => Promise<boolean>;
    toggle: (enabled: boolean) => Promise<boolean>;
  };
  settings: {
    getPrivateLink: () => Promise<string>;
    setPrivateLink: (link: string) => Promise<string>;
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  sessions: {
    getAll: () => ipcRenderer.invoke('sessions:get'),
    add: (entry: SessionEntry) => ipcRenderer.invoke('sessions:add', entry),
    remove: (sessionId: string) => ipcRenderer.invoke('sessions:remove', sessionId),
    rename: (sessionId: string, newName: string) =>
      ipcRenderer.invoke('sessions:rename', sessionId, newName),
    reorder: (sessionId: string, direction: 'up' | 'down') =>
      ipcRenderer.invoke('sessions:reorder', sessionId, direction),
    open: (sessionId: string, customName: string) =>
      ipcRenderer.invoke('sessions:open', sessionId, customName),
    openPrivate: (sessionId: string, customName: string, privateLink: string) =>
      ipcRenderer.invoke('sessions:openPrivate', sessionId, customName, privateLink),
    getAvatar: (sessionId: string) => ipcRenderer.invoke('sessions:getAvatar', sessionId),
  },
  multiLoad: {
    getStatus: () => ipcRenderer.invoke('multiload:getStatus'),
    toggle: (enabled: boolean) => ipcRenderer.invoke('multiload:toggle', enabled),
  },
  settings: {
    getPrivateLink: () => ipcRenderer.invoke('settings:getPrivateLink'),
    setPrivateLink: (link: string) => ipcRenderer.invoke('settings:setPrivateLink', link),
  }
} satisfies ElectronAPI);
