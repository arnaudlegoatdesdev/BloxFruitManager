const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /\{privateLinkModalId && \(/,
  '{showGlobalPrivateModal && ('
);

code = code.replace(
  /value=\{privateLinkValue\}/,
  'value={tempPrivateLink}'
);

code = code.replace(
  /onChange=\{\(e\) => setPrivateLinkValue\(e.target.value\)\}/,
  'onChange={(e) => setTempPrivateLink(e.target.value)}'
);

code = code.replace(
  /setPrivateLinkModalId\(null\);\n\s+setPrivateLinkValue\(''\);/,
  'setShowGlobalPrivateModal(false);\n                  setTempPrivateLink(\'\');'
);
code = code.replace(
  /setPrivateLinkModalId\(null\);\n\s+setPrivateLinkValue\(''\);/,
  'setShowGlobalPrivateModal(false);\n                  setTempPrivateLink(\'\');'
);

code = code.replace(
  /\{privateLinkValue\.trim\(\) \? 'Save & Launch' : 'Save'\}/,
  "'Save Global Link'"
);

fs.writeFileSync('src/App.tsx', code);
