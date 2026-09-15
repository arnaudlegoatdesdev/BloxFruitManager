const fs = require('fs');
let content = fs.readFileSync('electron/main.ts', 'utf8');

const startIdx = content.indexOf('function launchRobloxIsolated(sessionId: string, robloxUrl: string) {');
const endIdx = content.indexOf('  } catch (err: any) {', startIdx);

const newFunc = `function launchRobloxIsolated(sessionId: string, robloxUrl: string) {
  try {
    console.log(\`[MultiLoad] Launching isolated Roblox for session: \${sessionId}\`);
    
    const baseAppPath = '/Applications/Roblox.app';
    if (!fs.existsSync(baseAppPath)) {
      throw new Error('Roblox.app introuvable dans /Applications');
    }

    const instancesDir = path.join(app.getPath('userData'), 'Instances');
    const fakeHome = path.join(instancesDir, \`Home_\${sessionId}\`);
    const isolatedApp = \`/tmp/Roblox_Session_\${sessionId}.app\`;

    // Clean previous temp app if exists
    if (fs.existsSync(isolatedApp)) {
      execSync(\`rm -rf "\${isolatedApp}"\`);
    }
    
    // Copy Roblox using APFS Clone (-cR) which takes ZERO extra disk space!
    console.log('[MultiLoad] Cloning Roblox application (APFS Copy-on-Write)...');
    execSync(\`cp -cR "\${baseAppPath}" "\${isolatedApp}" || cp -R "\${baseAppPath}" "\${isolatedApp}"\`);

    // Modify Info.plist to change Bundle ID and disable multiple instances prohibition.
    // This is REQUIRED because Roblox natively checks if its own Bundle ID is already running,
    // and if so, it kills the old one or forwards the URL to it!
    const plistPath = path.join(isolatedApp, 'Contents', 'Info');
    console.log('[MultiLoad] Modifying Info.plist...');
    execSync(\`defaults write "\${plistPath}" CFBundleIdentifier "com.roblox.RobloxPlayer.\${sessionId}"\`);
    execSync(\`defaults write "\${plistPath}" LSMultipleInstancesProhibited -bool false\`);

    // Resign the app to fix the broken signature from modifying Info.plist
    console.log('[MultiLoad] Re-signing the modified application...');
    execSync(\`codesign --force --deep --sign - "\${isolatedApp}"\`);

    // CRITICAL: We must delete the embedded RobloxPlayerInstaller from our clone.
    // By deleting it, Roblox skips the update check and launches the game directly!
    const installerPath = path.join(isolatedApp, 'Contents', 'MacOS', 'RobloxPlayerInstaller.app');
    execSync(\`rm -rf "\${installerPath}"\`);

    // Create isolated home directory structure
    const fakeLibrary = path.join(fakeHome, 'Library');
    if (!fs.existsSync(fakeLibrary)) {
      fs.mkdirSync(fakeLibrary, { recursive: true });
    }

    // Seed the Fake Home with the real version data so the game doesn't say "Mise à jour exigée"
    // We STRICTLY EXCLUDE \`*.xml\` (GlobalBasicSettings) to prevent the "impossible de trouver les clées" Keychain error!
    const realHome = app.getPath('home');
    const realRobloxDir = path.join(realHome, 'Library', 'Roblox');
    const fakeRobloxDir = path.join(fakeLibrary, 'Roblox');
    
    if (fs.existsSync(realRobloxDir)) {
      console.log('[MultiLoad] Seeding Fake Home to prevent Update Required prompt...');
      execSync(\`mkdir -p "\${fakeRobloxDir}"\`);
      execSync(\`rsync -a --exclude="LocalStorage" --exclude="*.xml" "\${realRobloxDir}/" "\${fakeRobloxDir}/"\`);
    }

    const realHTTP = path.join(realHome, 'Library', 'HTTPStorages', 'com.roblox.RobloxPlayer');
    const fakeHTTP = path.join(fakeLibrary, 'HTTPStorages', 'com.roblox.RobloxPlayer');
    if (fs.existsSync(realHTTP)) {
      execSync(\`mkdir -p "\${fakeHTTP}"\`);
      execSync(\`rsync -a --exclude="*.binarycookies" "\${realHTTP}/" "\${fakeHTTP}/"\`);
    }

    // Launch!
    console.log('[MultiLoad] 🚀 Starting isolated instance...');
    
    // We execute the binary directly instead of using 'open -a'.
    // This bypasses LaunchServices AppleEvents (so we can have identical Bundle IDs)
    // and prevents Roblox from delegating the launch to the 'RobloxPlayerInstaller' updater.
    const binaryPath = path.join(isolatedApp, 'Contents', 'MacOS', 'RobloxPlayer');
    const launchCmd = \`env HOME="\${fakeHome}" "\${binaryPath}" "\${robloxUrl}" > /dev/null 2>&1 &\`;
    
    execSync(launchCmd);
    
    console.log('[MultiLoad] ✅ Isolated instance launched successfully!');
\`;

fs.writeFileSync('electron/main.ts', content.substring(0, startIdx) + newFunc + content.substring(endIdx));
