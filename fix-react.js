const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Fix openPrivateLinkSettings
code = code.replace(
  /const openPrivateLinkSettings = \(session: SessionEntry\) => \{\s+setPrivateLinkModalId\(session\.id\);\s+setPrivateLinkValue\(session\.privateLink \|\| ''\);\s+\};/g,
  `const openPrivateLinkSettings = () => {
    setTempPrivateLink(globalPrivateLink);
    setShowGlobalPrivateModal(true);
  };`
);

// 2. Fix handleOpenPrivate
code = code.replace(
  /function handleOpenPrivate\(session: SessionEntry\) \{\s+if \(globalPrivateLink\) \{\s+window\.electronAPI\.sessions\.openPrivate\(session\.id, session\.customName, globalPrivateLink\);\s+\} else \{\s+openPrivateLinkSettings\(\);\s+\}\s+\}/g,
  `function handleOpenPrivate(session: SessionEntry) {
    if (globalPrivateLink) {
      window.electronAPI.sessions.openPrivate(session.id, session.customName, globalPrivateLink);
    } else {
      openPrivateLinkSettings();
    }
  }`
);

fs.writeFileSync('src/App.tsx', code);
