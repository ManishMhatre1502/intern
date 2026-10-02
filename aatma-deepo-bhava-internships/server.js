'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getCollections, findSession, removeSession, rateLimitExceeded, saveSession } = require('./storage');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL = 12 * 60 * 60 * 1000;
const cookieName = 'adb_session';
const production = process.env.NODE_ENV === 'production';

function loadLocalEnvironment() {
  let contents;
  try {
    contents = require('node:fs').readFileSync(path.join(ROOT, '.env'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

loadLocalEnvironment();

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const pair = part.trim().split(/=(.*)/s).slice(0, 2);
    return pair.length === 2 ? pair : [];
  }).filter(pair => pair.length === 2));
}

function safeAccount(account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    mobile: account.mobile,
    createdAt: account.createdAt
  };
}

async function createSession(res, identity) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_TTL;
  await saveSession(token, identity, expiresAt);
  res.setHeader('Set-Cookie',
    `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${production ? '; Secure' : ''}`);
}

async function getSession(req) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  const session = await findSession(token);
  return session ? { token, ...session } : null;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) {
      throw Object.assign(new Error('Request is too large.'), { status: 413 });
    }
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), { status: 400 });
  }
}

function sameOrigin(req) {
  if (!req.headers.origin) return true;
  const protocol = production ? 'https' : 'http';
  return req.headers.origin === `${protocol}://${req.headers.host}`;
}

function passwordMatches(password, saltHex, expectedHex) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, (error, derived) => {
      if (error) return reject(error);
      const expected = Buffer.from(expectedHex, 'hex');
      resolve(expected.length === derived.length && crypto.timingSafeEqual(expected, derived));
    });
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(salt, 'hex'), 64, (error, derived) => {
      if (error) return reject(error);
      resolve({ salt, hash: derived.toString('hex') });
    });
  });
}

function verifyAdminPasswordHash() {
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i
    .exec(process.env.ADMIN_PASSWORD_HASH || '');
  return match ? { salt: match[1], hash: match[2] } : null;
}

function duplicateKey(error) {
  return error && error.code === 11000;
}

function getEnrollmentStatus(enrollment, today = new Date().toISOString().slice(0, 10)) {
  if (enrollment.endDate < today) return 'Completed';
  if (enrollment.startDate <= today) return 'In Progress';
  return 'Upcoming';
}

async function handleApi(req, res, url) {
  if (!sameOrigin(req) && req.method !== 'GET') {
    return sendJson(res, 403, { error: 'Request origin rejected.' });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/session') {
    const session = await getSession(req);
    if (!session) return sendJson(res, 200, { user: null });
    if (session.role === 'admin') {
      return sendJson(res, 200, { user: { role: 'admin', username: session.username } });
    }
    const { accounts } = await getCollections();
    const account = await accounts.findOne({ id: session.userId });
    if (!account) return sendJson(res, 200, { user: null });
    return sendJson(res, 200, { user: { ...safeAccount(account), role: 'user' } });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = parseCookies(req.headers.cookie)[cookieName];
    await removeSession(token);
    res.setHeader('Set-Cookie',
      `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    if (await rateLimitExceeded(req, 'register')) {
      return sendJson(res, 429, { error: 'Too many attempts. Try again later.' });
    }
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const mobile = String(body.mobile || '').trim();
    const password = String(body.password || '');

    if (name.length < 2 || name.length > 100) {
      return sendJson(res, 400, { error: 'Enter a valid name.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return sendJson(res, 400, { error: 'Enter a valid email address.' });
    }
    if (!/^\+?[0-9 ()-]{8,20}$/.test(mobile)) {
      return sendJson(res, 400, { error: 'Enter a valid mobile number.' });
    }
    if (password.length < 10 || password.length > 200) {
      return sendJson(res, 400, { error: 'Password must be at least 10 characters.' });
    }

    const { accounts } = await getCollections();
    if (await accounts.findOne({ email }, { projection: { _id: 1 } })) {
      return sendJson(res, 409, { error: 'An account with this email already exists.' });
    }
    const { salt, hash } = await hashPassword(password);
    const account = {
      id: crypto.randomUUID(), name, email, mobile, salt, hash,
      createdAt: new Date().toISOString()
    };
    try {
      await accounts.insertOne(account);
    } catch (error) {
      if (duplicateKey(error)) {
        return sendJson(res, 409, { error: 'An account with this email already exists.' });
      }
      throw error;
    }
    await createSession(res, { role: 'user', userId: account.id });
    return sendJson(res, 201, { user: { ...safeAccount(account), role: 'user' } });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    if (await rateLimitExceeded(req, 'login')) {
      return sendJson(res, 429, { error: 'Too many attempts. Try again later.' });
    }
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const { accounts } = await getCollections();
    const account = await accounts.findOne({ email });
    if (!account || !(await passwordMatches(password, account.salt, account.hash))) {
      return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    }
    await createSession(res, { role: 'user', userId: account.id });
    return sendJson(res, 200, { user: { ...safeAccount(account), role: 'user' } });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/admin-login') {
    if (await rateLimitExceeded(req, 'admin-login')) {
      return sendJson(res, 429, { error: 'Too many attempts. Try again later.' });
    }
    const configuredUsername = process.env.ADMIN_USERNAME;
    const passwordHash = verifyAdminPasswordHash();
    if (!configuredUsername || !passwordHash) {
      return sendJson(res, 503, {
        error: 'Admin login is disabled until the site owner configures ADMIN_USERNAME and ADMIN_PASSWORD_HASH on the server. The login form cannot configure these credentials.'
      });
    }
    const body = await readJson(req);
    const username = String(body.username || '');
    const password = String(body.password || '');
    const usernameBuffer = Buffer.from(username);
    const expectedUsername = Buffer.from(configuredUsername);
    const usernameOk = usernameBuffer.length === expectedUsername.length
      && crypto.timingSafeEqual(usernameBuffer, expectedUsername);
    const passwordOk = await passwordMatches(password, passwordHash.salt, passwordHash.hash);
    if (!usernameOk || !passwordOk) {
      return sendJson(res, 401, { error: 'Username or password is incorrect.' });
    }
    await createSession(res, { role: 'admin', username: configuredUsername });
    return sendJson(res, 200, { user: { role: 'admin', username: configuredUsername } });
  }

  if (req.method === 'POST' && url.pathname === '/api/internships/enroll') {
    const session = await getSession(req);
    if (!session || session.role !== 'user') {
      return sendJson(res, 401, { error: 'Please sign in with a student account before applying.' });
    }
    const body = await readJson(req);
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 160) {
      return sendJson(res, 400, { error: 'Choose a valid internship or course.' });
    }
    const { accounts, enrollments } = await getCollections();
    const account = await accounts.findOne({ id: session.userId });
    if (!account) {
      return sendJson(res, 401, { error: 'Your student account could not be found. Please sign in again.' });
    }
    const enrolledAt = new Date();
    const start = new Date(enrolledAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dateOnly = date => date.toISOString().slice(0, 10);
    const enrollment = {
      id: `ADB-${enrolledAt.getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: account.id,
      title,
      enrolledAt: enrolledAt.toISOString(),
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      paymentStatus: 'Paid (₹1000)'
    };
    await enrollments.insertOne(enrollment);
    return sendJson(res, 201, {
      enrollment: { ...enrollment, status: getEnrollmentStatus(enrollment) }
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/dashboard') {
    const session = await getSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 401, { error: 'Administrator access is required.' });
    }
    const dashboard = await fs.readFile(path.join(ROOT, 'admin-dashboard.html'));
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    return res.end(dashboard);
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/accounts') {
    const session = await getSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 401, { error: 'Administrator access is required.' });
    }
    const { accounts } = await getCollections();
    const records = await accounts.find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, mobile: 1, createdAt: 1 } })
      .sort({ createdAt: 1 }).toArray();
    return sendJson(res, 200, { accounts: records });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/dashboard-data') {
    const session = await getSession(req);
    if (!session || session.role !== 'admin') {
      return sendJson(res, 401, { error: 'Administrator access is required.' });
    }
    const { accounts, enrollments } = await getCollections();
    const [accountList, enrollmentList] = await Promise.all([
      accounts.find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, mobile: 1, createdAt: 1 } })
        .sort({ createdAt: 1 }).toArray(),
      enrollments.find({}, { projection: { _id: 0, id: 1, userId: 1, title: 1, enrolledAt: 1, startDate: 1, endDate: 1, paymentStatus: 1 } })
        .sort({ enrolledAt: -1 }).toArray()
    ]);
    const enrollmentByUser = new Map();
    for (const enrollment of enrollmentList) {
      const list = enrollmentByUser.get(enrollment.userId) || [];
      list.push({
        id: enrollment.id,
        title: enrollment.title,
        enrolledAt: enrollment.enrolledAt,
        startDate: enrollment.startDate,
        endDate: enrollment.endDate,
        paymentStatus: enrollment.paymentStatus,
        status: getEnrollmentStatus(enrollment)
      });
      enrollmentByUser.set(enrollment.userId, list);
    }
    const students = accountList.map(account => ({
      ...safeAccount(account),
      internships: enrollmentByUser.get(account.id) || []
    }));
    const internshipStudents = students.filter(student => student.internships.length > 0).length;
    return sendJson(res, 200, {
      summary: {
        totalStudents: students.length,
        internshipStudents,
        notStarted: students.length - internshipStudents
      },
      students
    });
  }

  return sendJson(res, 404, { error: 'Not found.' });
}

const allowedFile = pathname => {
  if (pathname === '/' || pathname === '/index.html') return path.join(ROOT, 'index.html');
  if (/^\/(css\/style\.css|js\/app\.js|hero_student\.png)$/.test(pathname)) {
    return path.join(ROOT, pathname.slice(1));
  }
  if (/^\/assets\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp|svg)$/.test(pathname)) {
    return path.join(ROOT, pathname.slice(1));
  }
  return null;
};

async function serveStatic(req, res, pathname) {
  const file = allowedFile(decodeURIComponent(pathname));
  if (!file) return sendJson(res, 404, { error: 'Not found.' });
  try {
    const body = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    return sendJson(res, 404, { error: 'Not found.' });
  }
}

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error('Request failed:', error.message);
    if (!res.headersSent) {
      return sendJson(res, error.status || 500, {
        error: error.status ? error.message : 'Server error.'
      });
    }
    return res.end();
  }
}

module.exports = requestHandler;

if (require.main === module) {
  http.createServer(requestHandler).listen(PORT, () => {
    if (!process.env.ADMIN_USERNAME || !verifyAdminPasswordHash()) {
      console.warn('Admin login disabled: configure ADMIN_USERNAME and ADMIN_PASSWORD_HASH.');
    }
    console.log(`Aatma Deepo Bhava is running at http://localhost:${PORT}`);
  });
}
