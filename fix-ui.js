const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Update Private button
code = code.replace(
  /onClick=\{\(\) => handleOpenPrivate\(s\)\}\n\s+className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 transition-colors cursor-pointer"\n\s+title=\{s\.privateLink \? 'Launch private server' : 'Set up private server link'\}/,
  `onClick={() => handleOpenPrivate(s)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 transition-colors cursor-pointer"
                  title="Launch private server"`
);

// Remove the individual gear button
code = code.replace(
  /\{\/\* Private link settings gear \*\/\}\n\s+<button\n\s+onClick=\{\(\) => openPrivateLinkSettings\(s\)\}\n\s+className="p-1\.5 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-500\/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"\n\s+title="Private link settings"\n\s+>\n\s+<svg[\s\S]*?<\/svg>\n\s+<\/button>\n\n\s+/,
  ''
);

fs.writeFileSync('src/App.tsx', code);
