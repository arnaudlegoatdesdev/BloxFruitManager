import { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface SessionEntry {
  id: string;
  customName: string;
  privateLink?: string;
}

export default function App() {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [privateLinkModalId, setPrivateLinkModalId] = useState<string | null>(null);
  const [privateLinkValue, setPrivateLinkValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const privateLinkRef = useRef<HTMLInputElement>(null);

  // Load sessions on mount
  useEffect(() => {
    window.electronAPI.sessions.getAll().then(setSessions);
  }, []);

  // Auto-focus inputs
  useEffect(() => {
    if (showAddModal) inputRef.current?.focus();
  }, [showAddModal]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (privateLinkModalId) privateLinkRef.current?.focus();
  }, [privateLinkModalId]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const entry: SessionEntry = { id: uuidv4(), customName: name };
    const updated = await window.electronAPI.sessions.add(entry);
    setSessions(updated);
    setNewName('');
    setShowAddModal(false);
  };

  const handleRemove = async (id: string) => {
    const updated = await window.electronAPI.sessions.remove(id);
    setSessions(updated);
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const updated = await window.electronAPI.sessions.rename(id, name);
    setSessions(updated);
    setEditingId(null);
    setEditName('');
  };

  const handleOpen = (session: SessionEntry) => {
    window.electronAPI.sessions.open(session.id, session.customName);
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const updated = await window.electronAPI.sessions.reorder(id, direction);
    setSessions(updated);
  };

  const handleOpenPrivate = (session: SessionEntry) => {
    if (session.privateLink) {
      window.electronAPI.sessions.openPrivate(session.id, session.customName, session.privateLink);
    } else {
      // No private link set — open settings modal
      setPrivateLinkModalId(session.id);
      setPrivateLinkValue('');
    }
  };

  const handleSavePrivateLink = async () => {
    if (!privateLinkModalId) return;
    const link = privateLinkValue.trim();
    const updated = await window.electronAPI.sessions.setPrivateLink(privateLinkModalId, link);
    setSessions(updated);
    // If a link was provided, open it immediately
    if (link) {
      const session = updated.find((s) => s.id === privateLinkModalId);
      if (session) {
        window.electronAPI.sessions.openPrivate(session.id, session.customName, link);
      }
    }
    setPrivateLinkModalId(null);
    setPrivateLinkValue('');
  };

  const openPrivateLinkSettings = (session: SessionEntry) => {
    setPrivateLinkModalId(session.id);
    setPrivateLinkValue(session.privateLink || '');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Draggable title bar region */}
      <div
        className="h-12 flex items-center justify-center shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs font-medium tracking-widest uppercase text-gray-500">
          Bloxfruit Manager
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-5 flex flex-col">
        {/* Session list */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <svg
                className="w-12 h-12 mb-3 opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <p className="text-sm">No sessions yet</p>
              <p className="text-xs text-gray-700 mt-1">Click below to add your first account</p>
            </div>
          )}

          {sessions.map((s, index) => (
            <div
              key={s.id}
              className="group flex items-center gap-2 rounded-xl bg-gray-900/60 border border-gray-800/50 px-3 py-3 transition-colors hover:border-gray-700/60 hover:bg-gray-900/80"
            >
              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleReorder(s.id, 'up')}
                  disabled={index === 0}
                  className="p-0.5 rounded text-gray-500 hover:text-white disabled:text-gray-800 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Move up"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleReorder(s.id, 'down')}
                  disabled={index === sessions.length - 1}
                  className="p-0.5 rounded text-gray-500 hover:text-white disabled:text-gray-800 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Move down"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Color indicator */}
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />

              {/* Name / rename */}
              {editingId === s.id ? (
                <input
                  ref={editRef}
                  className="flex-1 bg-gray-800 text-sm rounded-lg px-3 py-1.5 outline-none ring-1 ring-gray-700 focus:ring-indigo-500 transition-shadow"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(s.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => setEditingId(null)}
                />
              ) : (
                <span
                  className="flex-1 text-sm font-medium truncate cursor-pointer"
                  onDoubleClick={() => {
                    setEditingId(s.id);
                    setEditName(s.customName);
                  }}
                  title="Double-click to rename"
                >
                  {s.customName}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Open button */}
                <button
                  onClick={() => handleOpen(s)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Open
                </button>

                {/* Launch Private button */}
                <button
                  onClick={() => handleOpenPrivate(s)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 transition-colors cursor-pointer"
                  title={s.privateLink ? 'Launch private server' : 'Set up private server link'}
                >
                  Private
                </button>

                {/* Private link settings gear */}
                <button
                  onClick={() => openPrivateLinkSettings(s)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Private link settings"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleRemove(s.id)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Delete session"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add session button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="mt-4 w-full py-3 rounded-xl border border-dashed border-gray-700 text-sm font-medium text-gray-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer"
        >
          + Add New Session
        </button>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-80 shadow-2xl">
            <h2 className="text-base font-semibold mb-4">New Session</h2>
            <input
              ref={inputRef}
              className="w-full bg-gray-800 text-sm rounded-lg px-4 py-2.5 outline-none ring-1 ring-gray-700 focus:ring-indigo-500 transition-shadow placeholder:text-gray-600"
              placeholder="e.g. BloxyMain, Alt 1…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowAddModal(false);
              }}
            />
            <p className="text-xs text-gray-600 mt-2">
              💡 Prefix with <span className="text-indigo-400 font-medium">Bloxy</span> to auto-open Blox Fruits
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="flex-1 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private link settings modal */}
      {privateLinkModalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-96 shadow-2xl">
            <h2 className="text-base font-semibold mb-1">Private Server Link</h2>
            <p className="text-xs text-gray-500 mb-4">
              Paste your private server share link below. It will be saved for this session.
            </p>
            <input
              ref={privateLinkRef}
              className="w-full bg-gray-800 text-sm rounded-lg px-4 py-2.5 outline-none ring-1 ring-gray-700 focus:ring-violet-500 transition-shadow placeholder:text-gray-600"
              placeholder="https://www.roblox.com/share?code=...&type=Server"
              value={privateLinkValue}
              onChange={(e) => setPrivateLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePrivateLink();
                if (e.key === 'Escape') {
                  setPrivateLinkModalId(null);
                  setPrivateLinkValue('');
                }
              }}
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setPrivateLinkModalId(null);
                  setPrivateLinkValue('');
                }}
                className="flex-1 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrivateLink}
                className="flex-1 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors cursor-pointer"
              >
                {privateLinkValue.trim() ? 'Save & Launch' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
