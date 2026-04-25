const express      = require('express');
const multer       = require('multer');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const fs           = require('fs');
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3700;
const JWT_SECRET = 'ovia_secret_2025_xK9mP';

// ── KURUCU HESABI — buradan değiştir ─────────────────────────
const FOUNDER_USERNAME = 'Haktan';
const FOUNDER_EMAIL    = 'haktan@gmail.com';
const FOUNDER_PASSWORD = 'haktan1234';

// ── paths ─────────────────────────────────────────────────────
const DATA_DIR    = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AVATARS_DIR = path.join(__dirname, 'uploads', 'avatars');
const USERS_FILE  = path.join(DATA_DIR, 'users.json');
const FILES_FILE  = path.join(DATA_DIR, 'files.json');
const LOG_FILE    = path.join(DATA_DIR, 'accounts.log');

[DATA_DIR, UPLOADS_DIR, AVATARS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(FILES_FILE)) fs.writeFileSync(FILES_FILE, '[]');

const readJSON  = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function writeLog(action, data) {
  const ts   = new Date().toISOString();
  const line = `[${ts}] ${action.padEnd(20)} | ${JSON.stringify(data)}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log('\x1b[36m%s\x1b[0m', line.trim());
}

function sanitize(u) { const { password, ...s } = u; return s; }

// ── Kurucu hesabını sadece 1 kez oluştur ─────────────────────
async function ensureFounder() {
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.role === 'founder')) {
    console.log('\x1b[32m  ✓ Kurucu hesabı mevcut\x1b[0m');
    return;
  }
  const hash = await bcrypt.hash(FOUNDER_PASSWORD, 10);
  users.unshift({
    id: uuidv4(), username: FOUNDER_USERNAME,
    email: FOUNDER_EMAIL, password: hash,
    role: 'founder', avatar: '👑',
    profilePhoto: '', banner: '',
    bio: 'Ovia Kurucusu',
    accentColor: '#f59e0b',
    createdAt: new Date().toISOString(),
  });
  writeJSON(USERS_FILE, users);
  writeLog('FOUNDER_CREATED', { username: FOUNDER_USERNAME });
  console.log(`\x1b[33m\n  ★ KURUCU HESABI OLUŞTURULDU\n  E-posta: ${FOUNDER_EMAIL}\n  Şifre  : ${FOUNDER_PASSWORD}\x1b[0m\n`);
}
ensureFounder();

// ── auth middleware ───────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Giriş yapman gerekiyor' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Geçersiz oturum' }); }
}

function founderOnly(req, res, next) {
  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.id === req.user.id);
  if (!user || user.role !== 'founder')
    return res.status(403).json({ error: 'Sadece kurucu erişebilir' });
  next();
}

function optionalAuth(req, res, next) {
  const token = req.cookies?.token;
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch {} }
  next();
}

// ── multer: dosya yükleme ─────────────────────────────────────
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: fileStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── multer: profil fotoğrafı ──────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => cb(null, `photo_${uuidv4()}${path.extname(file.originalname)}`),
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Sadece görsel')),
});

// ── multer: banner / GIF ──────────────────────────────────────
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => cb(null, `banner_${uuidv4()}${path.extname(file.originalname)}`),
});
const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Sadece görsel/GIF')),
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Tüm alanlar zorunlu' });
  if (!email.endsWith('@gmail.com'))
    return res.status(400).json({ error: 'Sadece Gmail adresi kabul edilir (@gmail.com)' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email === email || u.username === username))
    return res.status(409).json({ error: 'Kullanıcı adı veya e-posta zaten alınmış' });

  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(), username, email, password: hash,
    role: 'user', avatar: '', profilePhoto: '', banner: '',
    bio: '', accentColor: '#6c63ff',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeJSON(USERS_FILE, users);
  writeLog('REGISTER', { id: user.id, username, email, ip: req.ip });

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ ok: true, user: sanitize(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Hatalı e-posta veya şifre' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    writeLog('LOGIN_FAIL', { email, ip: req.ip });
    return res.status(401).json({ error: 'Hatalı e-posta veya şifre' });
  }
  writeLog('LOGIN', { id: user.id, username: user.username, role: user.role, ip: req.ip });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ ok: true, user: sanitize(user) });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token'); res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = readJSON(USERS_FILE).find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ user: sanitize(user) });
});

// ════════════════════════════════════════════════════════════
//  USER / PROFILE
// ════════════════════════════════════════════════════════════

app.patch('/api/user/profile', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  const { username, bio, accentColor, avatar } = req.body;
  if (username && username !== users[idx].username) {
    if (users.find(u => u.username === username))
      return res.status(409).json({ error: 'Kullanıcı adı alınmış' });
    users[idx].username = username;
  }
  if (bio         !== undefined) users[idx].bio         = bio.slice(0, 200);
  if (accentColor !== undefined) users[idx].accentColor = accentColor;
  if (avatar      !== undefined) users[idx].avatar      = avatar;
  writeJSON(USERS_FILE, users);
  writeLog('PROFILE_UPDATE', { id: req.user.id, username: users[idx].username });
  res.json({ ok: true, user: sanitize(users[idx]) });
});

// Profil fotoğrafı yükle
app.post('/api/user/photo', authMiddleware, photoUpload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fotoğraf seçilmedi' });
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  if (users[idx].profilePhoto) {
    const old = path.join(AVATARS_DIR, path.basename(users[idx].profilePhoto));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  users[idx].profilePhoto = `/uploads/avatars/${req.file.filename}`;
  writeJSON(USERS_FILE, users);
  writeLog('PHOTO_UPLOAD', { username: users[idx].username });
  res.json({ ok: true, user: sanitize(users[idx]) });
});

// Profil fotoğrafı kaldır
app.delete('/api/user/photo', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  if (users[idx].profilePhoto) {
    const old = path.join(AVATARS_DIR, path.basename(users[idx].profilePhoto));
    if (fs.existsSync(old)) fs.unlinkSync(old);
    users[idx].profilePhoto = '';
  }
  writeJSON(USERS_FILE, users);
  res.json({ ok: true, user: sanitize(users[idx]) });
});

// Banner yükle (GIF destekli)
app.post('/api/user/banner', authMiddleware, bannerUpload.single('banner'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  if (users[idx].banner) {
    const old = path.join(AVATARS_DIR, path.basename(users[idx].banner));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  users[idx].banner = `/uploads/avatars/${req.file.filename}`;
  writeJSON(USERS_FILE, users);
  writeLog('BANNER_UPLOAD', { username: users[idx].username });
  res.json({ ok: true, user: sanitize(users[idx]) });
});

// Banner kaldır
app.delete('/api/user/banner', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  if (users[idx].banner) {
    const old = path.join(AVATARS_DIR, path.basename(users[idx].banner));
    if (fs.existsSync(old)) fs.unlinkSync(old);
    users[idx].banner = '';
  }
  writeJSON(USERS_FILE, users);
  res.json({ ok: true, user: sanitize(users[idx]) });
});

// ════════════════════════════════════════════════════════════
//  FILES
// ════════════════════════════════════════════════════════════

app.post('/api/files/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
  const files = readJSON(FILES_FILE);
  const users = readJSON(USERS_FILE);
  const owner = users.find(u => u.id === req.user.id);
  const record = {
    id: uuidv4(), ownerId: req.user.id,
    ownerName   : owner?.username    || 'Bilinmiyor',
    ownerAvatar : owner?.avatar      || '',
    ownerPhoto  : owner?.profilePhoto|| '',
    ownerAccent : owner?.accentColor || '#6c63ff',
    ownerRole   : owner?.role        || 'user',
    originalName: req.file.originalname,
    storedName  : req.file.filename,
    size        : req.file.size,
    mimetype    : req.file.mimetype,
    description : (req.body.description || '').slice(0, 300),
    tags        : (req.body.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 5),
    downloads   : 0,
    createdAt   : new Date().toISOString(),
  };
  files.unshift(record);
  writeJSON(FILES_FILE, files);
  writeLog('FILE_UPLOAD', { file: req.file.originalname, size: req.file.size, owner: owner?.username });
  res.json({ ok: true, file: record });
});

app.get('/api/files', optionalAuth, (req, res) => {
  let result = readJSON(FILES_FILE);
  const q    = (req.query.q || '').toLowerCase();
  const type = req.query.type || '';
  if (q) result = result.filter(f =>
    f.originalName.toLowerCase().includes(q) ||
    f.description.toLowerCase().includes(q)  ||
    f.tags.some(t => t.toLowerCase().includes(q))
  );
  if (type === 'image') result = result.filter(f => f.mimetype.startsWith('image/'));
  if (type === 'video') result = result.filter(f => f.mimetype.startsWith('video/'));
  if (type === 'audio') result = result.filter(f => f.mimetype.startsWith('audio/'));
  if (type === 'doc')   result = result.filter(f => f.mimetype.includes('pdf') || f.mimetype.includes('document') || f.mimetype.includes('text'));
  res.json({ files: result, total: result.length });
});

app.get('/api/files/mine', authMiddleware, (req, res) => {
  res.json({ files: readJSON(FILES_FILE).filter(f => f.ownerId === req.user.id) });
});

app.delete('/api/files/:id', authMiddleware, (req, res) => {
  const users   = readJSON(USERS_FILE);
  const reqUser = users.find(u => u.id === req.user.id);
  let files     = readJSON(FILES_FILE);
  const file    = files.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Dosya bulunamadı' });
  if (file.ownerId !== req.user.id && reqUser?.role !== 'founder')
    return res.status(403).json({ error: 'Bu dosyayı silme yetkin yok' });
  const fp = path.join(UPLOADS_DIR, file.storedName);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  writeJSON(FILES_FILE, files.filter(f => f.id !== req.params.id));
  writeLog('FILE_DELETE', { file: file.originalName, deletedBy: reqUser?.username });
  res.json({ ok: true });
});

app.get('/api/files/:id/download', (req, res) => {
  const files = readJSON(FILES_FILE);
  const idx   = files.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  files[idx].downloads++;
  writeJSON(FILES_FILE, files);
  writeLog('DOWNLOAD', { file: files[idx].originalName });
  res.json({ ok: true, url: `/uploads/${files[idx].storedName}` });
});

// ════════════════════════════════════════════════════════════
//  ADMIN — SADECE KURUCU
// ════════════════════════════════════════════════════════════

app.get('/api/admin/logs', authMiddleware, founderOnly, (req, res) => {
  if (!fs.existsSync(LOG_FILE)) return res.json({ logs: [] });
  const logs = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean).reverse().slice(0, 500);
  res.json({ logs });
});

app.get('/api/admin/users', authMiddleware, founderOnly, (req, res) => {
  res.json({ users: readJSON(USERS_FILE).map(sanitize) });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log('\n\x1b[35m  Ovia v3.0\x1b[0m');
  console.log(`\x1b[32m  ► http://localhost:${PORT}\x1b[0m\n`);
});