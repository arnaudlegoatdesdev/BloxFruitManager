const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Replacements for State
code = code.replace(
  "const [privateLinkModalId, setPrivateLinkModalId] = useState<string | null>(null);",
  "const [showGlobalPrivateModal, setShowGlobalPrivateModal] = useState(false);\n  const [globalPrivateLink, setGlobalPrivateLink] = useState('');\n  const [tempPrivateLink, setTempPrivateLink] = useState('');"
);
code = code.replace(
  "const [privateLinkValue, setPrivateLinkValue] = useState('');",
  ""
);

// 2. Load globalPrivateLink on mount
code = code.replace(
  "window.electronAPI.multiLoad.getStatus().then(setMultiLoadEnabled);",
  "window.electronAPI.multiLoad.getStatus().then(setMultiLoadEnabled);\n    window.electronAPI.settings.getPrivateLink().then(setGlobalPrivateLink);"
);

// 3. Fix auto-focus
code = code.replace(
  "if (privateLinkModalId) privateLinkRef.current?.focus();\n  }, [privateLinkModalId]);",
  "if (showGlobalPrivateModal) privateLinkRef.current?.focus();\n  }, [showGlobalPrivateModal]);"
);

// 4. Modify handleOpenPrivate
code = code.replace(
  /function handleOpenPrivate\(session: SessionEntry\) \{\s+if \(session\.privateLink\) \{\s+window\.electronAPI\.sessions\.openPrivate\(session\.id, session\.customName, session\.privateLink\);\s+\} else \{\s+openPrivateLinkSettings\(session\);\s+\}\s+\}/g,
  `function handleOpenPrivate(session: SessionEntry) {
    if (globalPrivateLink) {
      window.electronAPI.sessions.openPrivate(session.id, session.customName, globalPrivateLink);
    } else {
      openPrivateLinkSettings();
    }
  }`
);

// 5. Modify openPrivateLinkSettings
code = code.replace(
  /function openPrivateLinkSettings\(session: SessionEntry\) \{\s+setPrivateLinkModalId\(session\.id\);\s+setPrivateLinkValue\(session\.privateLink \|\| ''\);\s+\}/g,
  `function openPrivateLinkSettings() {
    setTempPrivateLink(globalPrivateLink);
    setShowGlobalPrivateModal(true);
  }`
);

// 6. Modify handleSavePrivateLink
code = code.replace(
  /async function handleSavePrivateLink\(\) \{\s+if \(!privateLinkModalId\) return;\s+const link = privateLinkValue\.trim\(\);\s+const updated = await window\.electronAPI\.sessions\.setPrivateLink\(privateLinkModalId, link\);\s+setSessions\(updated\);\s+if \(link\) \{\s+const session = updated\.find\(\(s\) => s\.id === privateLinkModalId\);\s+if \(session\) handleOpenPrivate\(session\);\s+\}\s+setPrivateLinkModalId\(null\);\s+\}/g,
  `async function handleSavePrivateLink() {
    const link = tempPrivateLink.trim();
    await window.electronAPI.settings.setPrivateLink(link);
    setGlobalPrivateLink(link);
    setShowGlobalPrivateModal(false);
  }`
);

fs.writeFileSync('src/App.tsx', code);
