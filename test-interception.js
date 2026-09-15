const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  
  win.webContents.on('will-navigate', (event, url) => {
    console.log('will-navigate:', url);
  });
  
  win.webContents.on('will-frame-navigate', (event) => {
    console.log('will-frame-navigate:', event.url);
    if (event.url.startsWith('roblox-player://')) {
      event.preventDefault();
      console.log('INTERCEPTED!');
    }
  });

  win.loadURL('data:text/html,<html><body><script>setTimeout(() => { const i = document.createElement("iframe"); i.src = "roblox-player://test"; document.body.appendChild(i); }, 1000);</script></body></html>');
});
