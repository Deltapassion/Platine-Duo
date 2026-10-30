// Platine DUO — application de bureau (Electron)
// © 2026 Jacques Branas, en collaboration avec Claude.ai — logiciel libre, GNU GPL v2 ou ultérieure
const { app, BrowserWindow, session, shell, ipcMain, Menu, net, dialog } = require('electron');
const fs = require('fs'), crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');

app.setAppUserModelId('fr.jacques.platineduo');
// même dossier de données que les versions précédentes : réglages, mappings, repères et sons du sampleur sont conservés
app.setPath('userData', path.join(app.getPath('appData'), 'Platine Duo'));
app.commandLine.appendSwitch('enable-experimental-web-platform-features');   // Web Bluetooth sous Linux et Mac
if (!app.requestSingleInstanceLock()) { app.quit(); }

const PAGE = path.join(__dirname, 'app', 'index.html');
const PAGE_URL = pathToFileURL(PAGE).href;
let win = null, btCallback = null;

// la page du logiciel est la seule autorisée à utiliser le MIDI, l'USB et le Bluetooth
const isOurPage = url => typeof url === 'string' && url.split('#')[0] === PAGE_URL;

// adresses que l'application peut lire pour la page (services sans accès direct depuis une page locale)
const NET_ALLOWED = [/^api\.deezer\.com$/, /\.dzcdn\.net$/];
function checkNetUrl(u){
  let url; try { url = new URL(String(u)); } catch (e) { throw new Error('adresse invalide'); }
  if (url.protocol !== 'https:' || !NET_ALLOWED.some(r => r.test(url.hostname))) throw new Error('adresse non autorisée');
  return url.href;
}
const fromPage = e => e.senderFrame && isOurPage(e.senderFrame.url);

function createWindow(){
  win = new BrowserWindow({
    width: 1500, height: 920, minWidth: 1100, minHeight: 700, show: false,
    title: 'Platine DUO', backgroundColor: '#0a0c11', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false
    }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(PAGE);

  // aucune navigation hors du logiciel ; les liens https s'ouvrent dans le navigateur par défaut
  const openOutside = url => { try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch (e) {} };
  win.webContents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isOurPage(url)) { e.preventDefault(); openOutside(url); } });
  win.webContents.on('will-attach-webview', e => e.preventDefault());

  // Bluetooth MIDI : la liste des appareils est affichée dans la page
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault(); btCallback = callback;
    win.webContents.send('bt-devices', devices.map(d => ({ deviceId: d.deviceId, deviceName: d.deviceName })));
  });
}

ipcMain.on('bt-select', (e, id) => {
  if (!fromPage(e) || !btCallback) return;
  btCallback(typeof id === 'string' ? id.slice(0, 200) : ''); btCallback = null;
});
ipcMain.handle('net-json', async (e, u) => {
  if (!fromPage(e)) throw new Error('refusé');
  const r = await net.fetch(checkNetUrl(u)); if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
});
// ---- dossiers de la soirée par styles : choisis par l'utilisateur dans la fenêtre du système, seuls lisibles ----
const AUDIO = /\.(mp3|wav|ogg|oga|flac|m4a|mp4|aac|opus|webm|aiff?)$/i;
const rootsFile = () => path.join(app.getPath('userData'), 'soiree-dossiers.json');
let roots = null;
function getRoots(){
  if (roots) return roots;
  try { roots = JSON.parse(fs.readFileSync(rootsFile(), 'utf8')).filter(r => r && typeof r.id === 'string' && typeof r.path === 'string'); } catch (e) { roots = []; }
  return roots;
}
function saveRoots(){ try { fs.writeFileSync(rootsFile(), JSON.stringify(getRoots())); } catch (e) {} }
const rootOf = id => getRoots().find(r => r.id === id);
ipcMain.handle('dir-pick', async e => {
  if (!fromPage(e)) throw new Error('refusé');
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
  const p = fs.realpathSync(r.filePaths[0]);
  let root = getRoots().find(x => x.path === p);
  if (!root) { root = { id: crypto.randomUUID(), path: p }; getRoots().push(root); saveRoots(); }
  return { id: root.id, name: path.basename(p) };
});
ipcMain.handle('dir-list', async (e, id) => {
  if (!fromPage(e)) throw new Error('refusé');
  const root = rootOf(String(id)); if (!root) return null;
  const out = [];
  const walk = async (dir, depth) => {
    if (depth > 4 || out.length >= 5000) return;
    let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (er) { return; }
    for (const en of ents) {
      if (out.length >= 5000) return;
      const full = path.join(dir, en.name);
      if (en.isDirectory()) await walk(full, depth + 1);
      else if (en.isFile() && AUDIO.test(en.name)) { try { const st = await fs.promises.stat(full); out.push({ rel: path.relative(root.path, full), size: st.size, mtime: Math.round(st.mtimeMs) }); } catch (er) {} }
    }
  };
  if (!fs.existsSync(root.path)) return null;
  await walk(root.path, 0);
  return { name: path.basename(root.path), files: out };
});
ipcMain.handle('dir-read', async (e, id, rel, start, end) => {
  if (!fromPage(e)) throw new Error('refusé');
  const root = rootOf(String(id)); if (!root) throw new Error('dossier inconnu');
  const full = fs.realpathSync(path.resolve(root.path, String(rel)));
  const base = root.path.endsWith(path.sep) ? root.path : root.path + path.sep;
  if (!full.startsWith(base) || !AUDIO.test(full)) throw new Error('fichier non autorisé');
  const size = fs.statSync(full).size, a = Math.max(0, Math.floor(+start || 0)), b = Math.min(size, Math.floor(end == null ? size : +end));
  if (b - a > 512 * 1024 * 1024) throw new Error('fichier trop gros');
  const buf = Buffer.alloc(Math.max(0, b - a)), fd = await fs.promises.open(full, 'r');
  try { await fd.read(buf, 0, buf.length, a); } finally { await fd.close(); }
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
});
ipcMain.handle('dir-forget', async (e, id) => {
  if (!fromPage(e)) throw new Error('refusé');
  roots = getRoots().filter(r => r.id !== String(id)); saveRoots(); return true;
});
ipcMain.handle('net-bytes', async (e, u) => {
  if (!fromPage(e)) throw new Error('refusé');
  const r = await net.fetch(checkNetUrl(u)); if (!r.ok) throw new Error('HTTP ' + r.status);
  const len = +r.headers.get('content-length') || 0; if (len > 64 * 1024 * 1024) throw new Error('fichier trop gros');
  return new Uint8Array(await r.arrayBuffer());
});

app.whenReady().then(() => {
  const ses = session.defaultSession;
  // fileSystem : lecture des dossiers de la soirée par styles, choisis par l'utilisateur
  const allowed = new Set(['midi', 'midiSysex', 'hid', 'media', 'bluetooth', 'speaker-selection', 'fullscreen', 'clipboard-sanitized-write', 'fileSystem']);
  ses.setPermissionRequestHandler((wc, perm, cb, details) => cb(allowed.has(perm) && isOurPage((details && details.requestingUrl) || wc.getURL())));
  ses.setPermissionCheckHandler((wc, perm, origin) => allowed.has(perm) && (origin === 'file://' || isOurPage(wc ? wc.getURL() : '')));
  ses.setDevicePermissionHandler(d => (d.deviceType === 'hid' || d.deviceType === 'bluetooth') && (d.origin === 'file://' || isOurPage(d.origin)));
  // USB HID : choisit le Gemini GMX s'il est branché, sinon le premier contrôleur proposé
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const list = details.deviceList || [];
    const pick = list.find(d => /gmx|gemini/i.test(d.name || '')) || list[0];
    callback(pick ? pick.deviceId : '');
  });

  const view = { label: 'Affichage', submenu: [
    { role: 'togglefullscreen', label: 'Plein écran' },
    { role: 'resetZoom', label: 'Taille normale' }, { role: 'zoomIn', label: 'Agrandir' }, { role: 'zoomOut', label: 'Réduire' },
    { type: 'separator' }, { role: 'reload', label: 'Recharger' }, { role: 'toggleDevTools', label: 'Outils de développement' }
  ] };
  // Mac : menu de l'application et menu Édition (copier / coller avec Cmd dans les champs de texte)
  Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === 'darwin' ? [
    { label: app.name, submenu: [
      { role: 'about', label: 'À propos de Platine DUO' }, { type: 'separator' },
      { role: 'hide', label: 'Masquer Platine DUO' }, { role: 'hideOthers', label: 'Masquer les autres' }, { role: 'unhide', label: 'Tout afficher' },
      { type: 'separator' }, { role: 'quit', label: 'Quitter Platine DUO' }
    ] },
    { label: 'Édition', submenu: [
      { role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' },
      { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' }
    ] },
    view,
    { label: 'Fenêtre', submenu: [{ role: 'minimize', label: 'Réduire dans le Dock' }, { role: 'zoom', label: 'Agrandir' }] }
  ] : [
    { label: 'Fichier', submenu: [{ role: 'quit', label: 'Quitter' }] },
    view
  ]));
  if (process.platform === 'darwin') app.setAboutPanelOptions({ applicationName: 'Platine DUO', applicationVersion: app.getVersion(), copyright: '© 2026 Jacques Branas (DJ LATIN JAZZ), en collaboration avec Claude.ai — GNU GPL v2+' });
  createWindow();
});

app.on('web-contents-created', (e, wc) => { wc.setWindowOpenHandler(() => ({ action: 'deny' })); });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
// Mac : un clic sur l'icône du Dock remet la fenêtre au premier plan
app.on('activate', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } else if (app.isReady()) createWindow(); });
