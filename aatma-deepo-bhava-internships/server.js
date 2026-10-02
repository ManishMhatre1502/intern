'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;

function loadLocalEnvironment() {
  let contents;

  try {
    contents = require('node:fs').readFileSync(
      path.join(ROOT, '.env'),
      'utf8'
    );
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match =
      /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);

    if (!match || Object.hasOwn(process.env, match[1])) continue;

    let value = match[2];

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
}

loadLocalEnvironment();

const DATA_DIR =
  process.env.DATA_DIR || path.join(ROOT, 'data');

const ACCOUNTS_FILE =
  path.join(DATA_DIR, 'accounts.json');

const ENROLLMENTS_FILE =
  path.join(DATA_DIR, 'enrollments.json');

const PORT =
  Number(process.env.PORT || 3000);

const SESSION_TTL =
  12 * 60 * 60 * 1000;

const sessions = new Map();
const attempts = new Map();

const cookieName = 'adb_session';

const production =
  process.env.NODE_ENV === 'production';


/* =========================================================
   ACCOUNT STORAGE
   ========================================================= */

async function readAccounts() {
  try {
    return JSON.parse(
      await fs.readFile(ACCOUNTS_FILE, 'utf8')
    );
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}


async function writeAccounts(accounts) {
  await fs.mkdir(
    DATA_DIR,
    {
      recursive: true,
      mode: 0o700
    }
  );

  const tempFile =
    `${ACCOUNTS_FILE}.${crypto
      .randomBytes(6)
      .toString('hex')}.tmp`;

  await fs.writeFile(
    tempFile,
    JSON.stringify(accounts, null, 2),
    {
      mode: 0o600
    }
  );

  await fs.rename(
    tempFile,
    ACCOUNTS_FILE
  );
}


/* =========================================================
   ENROLLMENT STORAGE
   ========================================================= */

async function readEnrollments() {
  try {
    return JSON.parse(
      await fs.readFile(
        ENROLLMENTS_FILE,
        'utf8'
      )
    );
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}


async function writeEnrollments(enrollments) {
  await fs.mkdir(
    DATA_DIR,
    {
      recursive: true,
      mode: 0o700
    }
  );

  const tempFile =
    `${ENROLLMENTS_FILE}.${crypto
      .randomBytes(6)
      .toString('hex')}.tmp`;

  await fs.writeFile(
    tempFile,
    JSON.stringify(enrollments, null, 2),
    {
      mode: 0o600
    }
  );

  await fs.rename(
    tempFile,
    ENROLLMENTS_FILE
  );
}


/* =========================================================
   ENROLLMENT STATUS
   ========================================================= */

function getEnrollmentStatus(
  enrollment,
  today = new Date().toISOString().slice(0, 10)
) {
  if (enrollment.endDate < today) {
    return 'Completed';
  }

  if (enrollment.startDate <= today) {
    return 'In Progress';
  }

  return 'Upcoming';
}


/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function sendJson(
  res,
  status,
  payload,
  headers = {}
) {
  res.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Cache-Control':
        'no-store',

      ...headers
    }
  );

  res.end(
    JSON.stringify(payload)
  );
}


/* =========================================================
   COOKIE HANDLING
   ========================================================= */

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part =>
        part
          .trim()
          .split(/=(.*)/s)
          .slice(0, 2)
      )
      .filter(pair =>
        pair.length === 2
      )
  );
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


/* =========================================================
   SESSION HANDLING
   ========================================================= */

function createSession(
  res,
  identity
) {
  const token =
    crypto.randomBytes(32)
      .toString('base64url');

  sessions.set(
    token,
    {
      ...identity,
      expiresAt:
        Date.now() + SESSION_TTL
    }
  );

  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; ` +
    `HttpOnly; ` +
    `SameSite=Strict; ` +
    `Path=/; ` +
    `Max-Age=${SESSION_TTL / 1000}` +
    `${production ? '; Secure' : ''}`
  );
}


function getSession(req) {
  const token =
    parseCookies(
      req.headers.cookie
    )[cookieName];

  const session =
    token && sessions.get(token);

  if (
    !session ||
    session.expiresAt < Date.now()
  ) {
    if (token) {
      sessions.delete(token);
    }

    return null;
  }

  return {
    token,
    ...session
  };
}


/* =========================================================
   JSON REQUEST BODY
   ========================================================= */

async function readJson(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 16_384) {
      throw Object.assign(
        new Error('Request is too large.'),
        {
          status: 413
        }
      );
    }
  }

  try {
    return JSON.parse(
      body || '{}'
    );
  } catch {
    throw Object.assign(
      new Error('Invalid JSON.'),
      {
        status: 400
      }
    );
  }
}


/* =========================================================
   SECURITY
   ========================================================= */

function sameOrigin(req) {
  if (!req.headers.origin) {
    return true;
  }

  const host =
    req.headers.host;

  const protocol =
    production
      ? 'https'
      : 'http';

  return (
    req.headers.origin ===
    `${protocol}://${host}`
  );
}


function rateLimited(
  req,
  key
) {
  const id =
    `${key}:${req.socket?.remoteAddress || 'unknown'}`;

  const now = Date.now();

  const windowMs =
    15 * 60 * 1000;

  const record =
    attempts.get(id) || {
      count: 0,
      resetAt:
        now + windowMs
    };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt =
      now + windowMs;
  }

  record.count += 1;

  attempts.set(
    id,
    record
  );

  return record.count > 10;
}


/* =========================================================
   PASSWORD SECURITY
   ========================================================= */

function passwordMatches(
  password,
  saltHex,
  expectedHex
) {
  return new Promise(
    (resolve, reject) => {
      crypto.scrypt(
        password,
        Buffer.from(
          saltHex,
          'hex'
        ),
        64,
        (error, derived) => {
          if (error) {
            return reject(error);
          }

          const expected =
            Buffer.from(
              expectedHex,
              'hex'
            );

          resolve(
            expected.length ===
              derived.length &&
            crypto.timingSafeEqual(
              expected,
              derived
            )
          );
        }
      );
    }
  );
}


function verifyAdminPasswordHash() {
  const match =
    /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i
      .exec(
        process.env.ADMIN_PASSWORD_HASH || ''
      );

  return match
    ? {
        salt: match[1],
        hash: match[2]
      }
    : null;
}


/* =========================================================
   API ROUTES
   ========================================================= */

async function handleApi(
  req,
  res,
  url
) {

  if (
    !sameOrigin(req) &&
    req.method !== 'GET'
  ) {
    return sendJson(
      res,
      403,
      {
        error:
          'Request origin rejected.'
      }
    );
  }


  /* -------------------------------------------------------
     CHECK CURRENT SESSION
     ------------------------------------------------------- */

  if (
    req.method === 'GET' &&
    url.pathname ===
      '/api/auth/session'
  ) {
    const session =
      getSession(req);

    if (!session) {
      return sendJson(
        res,
        200,
        {
          user: null
        }
      );
    }

    if (
      session.role === 'admin'
    ) {
      return sendJson(
        res,
        200,
        {
          user: {
            role: 'admin',
            username:
              session.username
          }
        }
      );
    }

    const accounts =
      await readAccounts();

    const account =
      accounts.find(
        item =>
          item.id ===
          session.userId
      );

    if (!account) {
      return sendJson(
        res,
        200,
        {
          user: null
        }
      );
    }

    return sendJson(
      res,
      200,
      {
        user: {
          ...safeAccount(account),
          role: 'user'
        }
      }
    );
  }


  /* -------------------------------------------------------
     LOGOUT
     ------------------------------------------------------- */

  if (
    req.method === 'POST' &&
    url.pathname ===
      '/api/auth/logout'
  ) {
    const session =
      getSession(req);

    if (session) {
      sessions.delete(
        session.token
      );
    }

    res.setHeader(
      'Set-Cookie',
      `${cookieName}=; ` +
      `HttpOnly; ` +
      `SameSite=Strict; ` +
      `Path=/; ` +
      `Max-Age=0` +
      `${production ? '; Secure' : ''}`
    );

    return sendJson(
      res,
      200,
      {
        ok: true
      }
    );
  }


  /* -------------------------------------------------------
     STUDENT REGISTRATION
     ------------------------------------------------------- */

  if (
    req.method === 'POST' &&
    url.pathname ===
      '/api/auth/register'
  ) {

    if (
      rateLimited(
        req,
        'register'
      )
    ) {
      return sendJson(
        res,
        429,
        {
          error:
            'Too many attempts. Try again later.'
        }
      );
    }

    const body =
      await readJson(req);

    const name =
      String(
        body.name || ''
      ).trim();

    const email =
      String(
        body.email || ''
      )
        .trim()
        .toLowerCase();

    const mobile =
      String(
        body.mobile || ''
      ).trim();

    const password =
      String(
        body.password || ''
      );

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      return sendJson(
        res,
        400,
        {
          error:
            'Enter a valid name.'
        }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return sendJson(
        res,
        400,
        {
          error:
            'Enter a valid email address.'
        }
      );
    }

    if (
      !/^\+?[0-9 ()-]{8,20}$/.test(
        mobile
      )
    ) {
      return sendJson(
        res,
        400,
        {
          error:
            'Enter a valid mobile number.'
        }
      );
    }

    if (
      password.length < 10 ||
      password.length > 200
    ) {
      return sendJson(
        res,
        400,
        {
          error:
            'Password must be at least 10 characters.'
        }
      );
    }

    const accounts =
      await readAccounts();

    if (
      accounts.some(
        account =>
          account.email === email
      )
    ) {
      return sendJson(
        res,
        409,
        {
          error:
            'An account with this email already exists.'
        }
      );
    }

    const salt =
      crypto.randomBytes(16)
        .toString('hex');

    const hash =
      await new Promise(
        (resolve, reject) => {
          crypto.scrypt(
            password,
            Buffer.from(
              salt,
              'hex'
            ),
            64,
            (
              error,
              derived
            ) =>
              error
                ? reject(error)
                : resolve(
                    derived.toString(
                      'hex'
                    )
                  )
          );
        }
      );

    const account = {
      id:
        crypto.randomUUID(),

      name,

      email,

      mobile,

      salt,

      hash,

      createdAt:
        new Date().toISOString()
    };

    accounts.push(
      account
    );

    await writeAccounts(
      accounts
    );

    createSession(
      res,
      {
        role: 'user',
        userId: account.id
      }
    );

    return sendJson(
      res,
      201,
      {
        user: {
          ...safeAccount(
            account
          ),
          role: 'user'
        }
      }
    );
  }


  /* -------------------------------------------------------
     STUDENT LOGIN
     ------------------------------------------------------- */

  if (
    req.method === 'POST' &&
    url.pathname ===
      '/api/auth/login'
  ) {

    if (
      rateLimited(
        req,
        'login'
      )
    ) {
      return sendJson(
        res,
        429,
        {
          error:
            'Too many attempts. Try again later.'
        }
      );
    }

    const body =
      await readJson(req);

    const email =
      String(
        body.email || ''
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body.password || ''
      );

    const accounts =
      await readAccounts();

    const account =
      accounts.find(
        item =>
          item.email === email
      );

    if (
      !account ||
      !(
        await passwordMatches(
          password,
          account.salt,
          account.hash
        )
      )
    ) {
      return sendJson(
        res,
        401,
        {
          error:
            'Email or password is incorrect.'
        }
      );
    }

    createSession(
      res,
      {
        role: 'user',
        userId: account.id
      }
    );

    return sendJson(
      res,
      200,
      {
        user: {
          ...safeAccount(
            account
          ),
          role: 'user'
        }
      }
    );
  }


  /* -------------------------------------------------------
     ADMIN LOGIN
     ------------------------------------------------------- */

  if (
    req.method === 'POST' &&
    url.pathname ===
      '/api/auth/admin-login'
  ) {

    if (
      rateLimited(
        req,
        'admin-login'
      )
    ) {
      return sendJson(
        res,
        429,
        {
          error:
            'Too many attempts. Try again later.'
        }
      );
    }

    const configuredUsername =
      process.env.ADMIN_USERNAME;

    const passwordHash =
      verifyAdminPasswordHash();

    if (
      !configuredUsername ||
      !passwordHash
    ) {
      return sendJson(
        res,
        503,
        {
          error:
            'Admin login is disabled until the site owner configures ADMIN_USERNAME and ADMIN_PASSWORD_HASH on the server, then restarts it. The login form cannot configure these credentials.'
        }
      );
    }

    const body =
      await readJson(req);

    const username =
      String(
        body.username || ''
      );

    const password =
      String(
        body.password || ''
      );

    const usernameBuffer =
      Buffer.from(username);

    const expectedUsername =
      Buffer.from(
        configuredUsername
      );

    const usernameOk =
      usernameBuffer.length ===
        expectedUsername.length &&
      crypto.timingSafeEqual(
        usernameBuffer,
        expectedUsername
      );

    const passwordOk =
      await passwordMatches(
        password,
        passwordHash.salt,
        passwordHash.hash
      );

    if (
      !usernameOk ||
      !passwordOk
    ) {
      return sendJson(
        res,
        401,
        {
          error:
            'Username or password is incorrect.'
        }
      );
    }

    createSession(
      res,
      {
        role: 'admin',
        username:
          configuredUsername
      }
    );

    return sendJson(
      res,
      200,
      {
        user: {
          role: 'admin',
          username:
            configuredUsername
        }
      }
    );
  }


  /* -------------------------------------------------------
     INTERNSHIP ENROLLMENT
     ------------------------------------------------------- */

  if (
    req.method === 'POST' &&
    url.pathname ===
      '/api/internships/enroll'
  ) {

    const session =
      getSession(req);

    if (
      !session ||
      session.role !== 'user'
    ) {
      return sendJson(
        res,
        401,
        {
          error:
            'Please sign in with a student account before applying.'
        }
      );
    }

    const body =
      await readJson(req);

    const title =
      String(
        body.title || ''
      ).trim();

    if (
      title.length < 2 ||
      title.length > 160
    ) {
      return sendJson(
        res,
        400,
        {
          error:
            'Choose a valid internship or course.'
        }
      );
    }

    const accounts =
      await readAccounts();

    const account =
      accounts.find(
        item =>
          item.id ===
          session.userId
      );

    if (!account) {
      return sendJson(
        res,
        401,
        {
          error:
            'Your student account could not be found. Please sign in again.'
        }
      );
    }

    const enrollments =
      await readEnrollments();

    const enrolledAt =
      new Date();

    const start =
      new Date(
        enrolledAt.getTime() +
        14 *
          24 *
          60 *
          60 *
          1000
      );

    const end =
      new Date(
        start.getTime() +
        30 *
          24 *
          60 *
          60 *
          1000
      );

    const dateOnly =
      date =>
        date
          .toISOString()
          .slice(0, 10);

    const enrollment = {
      id:
        `ADB-${enrolledAt.getFullYear()}-${crypto
          .randomBytes(3)
          .toString('hex')
          .toUpperCase()}`,

      userId:
        account.id,

      title,

      enrolledAt:
        enrolledAt.toISOString(),

      startDate:
        dateOnly(start),

      endDate:
        dateOnly(end),

      paymentStatus:
        'Paid (₹1000)'
    };

    enrollments.unshift(
      enrollment
    );

    await writeEnrollments(
      enrollments
    );

    return sendJson(
      res,
      201,
      {
        enrollment: {
          ...enrollment,
          status:
            getEnrollmentStatus(
              enrollment
            )
        }
      }
    );
  }


  /* -------------------------------------------------------
     ADMIN DASHBOARD
     ------------------------------------------------------- */

  if (
    req.method === 'GET' &&
    url.pathname ===
      '/api/admin/dashboard'
  ) {

    const session =
      getSession(req);

    if (
      !session ||
      session.role !== 'admin'
    ) {
      return sendJson(
        res,
        401,
        {
          error:
            'Administrator access is required.'
        }
      );
    }

    const dashboard =
      await fs.readFile(
        path.join(
          ROOT,
          'admin-dashboard.html'
        )
      );

    res.writeHead(
      200,
      {
        'Content-Type':
          'text/html; charset=utf-8',

        'Cache-Control':
          'no-store',

        'X-Content-Type-Options':
          'nosniff',

        'X-Frame-Options':
          'DENY'
      }
    );

    return res.end(
      dashboard
    );
  }


  /* -------------------------------------------------------
     ADMIN ACCOUNTS
     ------------------------------------------------------- */

  if (
    req.method === 'GET' &&
    url.pathname ===
      '/api/admin/accounts'
  ) {

    const session =
      getSession(req);

    if (
      !session ||
      session.role !== 'admin'
    ) {
      return sendJson(
        res,
        401,
        {
          error:
            'Administrator access is required.'
        }
      );
    }

    const accounts =
      await readAccounts();

    return sendJson(
      res,
      200,
      {
        accounts:
          accounts.map(
            safeAccount
          )
      }
    );
  }


  /* -------------------------------------------------------
     ADMIN DASHBOARD DATA
     ------------------------------------------------------- */

  if (
    req.method === 'GET' &&
    url.pathname ===
      '/api/admin/dashboard-data'
  ) {

    const session =
      getSession(req);

    if (
      !session ||
      session.role !== 'admin'
    ) {
      return sendJson(
        res,
        401,
        {
          error:
            'Administrator access is required.'
        }
      );
    }

    const [
      accounts,
      enrollments
    ] =
      await Promise.all([
        readAccounts(),
        readEnrollments()
      ]);

    const enrollmentByUser =
      new Map();

    for (
      const enrollment
      of enrollments
    ) {

      const list =
        enrollmentByUser.get(
          enrollment.userId
        ) || [];

      list.push({
        id:
          enrollment.id,

        title:
          enrollment.title,

        enrolledAt:
          enrollment.enrolledAt,

        startDate:
          enrollment.startDate,

        endDate:
          enrollment.endDate,

        paymentStatus:
          enrollment.paymentStatus,

        status:
          getEnrollmentStatus(
            enrollment
          )
      });

      enrollmentByUser.set(
        enrollment.userId,
        list
      );
    }

    const students =
      accounts.map(
        account => ({
          ...safeAccount(
            account
          ),

          internships:
            enrollmentByUser.get(
              account.id
            ) || []
        })
      );

    const internshipStudents =
      students.filter(
        student =>
          student.internships
            .length > 0
      ).length;

    return sendJson(
      res,
      200,
      {
        summary: {
          totalStudents:
            students.length,

          internshipStudents,

          notStarted:
            students.length -
            internshipStudents
        },

        students
      }
    );
  }


  /* -------------------------------------------------------
     API NOT FOUND
     ------------------------------------------------------- */

  return sendJson(
    res,
    404,
    {
      error:
        'Not found.'
    }
  );
}


/* =========================================================
   STATIC FILES
   ========================================================= */

const allowedFile =
  pathname => {

    if (
      pathname === '/' ||
      pathname === '/index.html'
    ) {
      return path.join(
        ROOT,
        'index.html'
      );
    }

    if (
      /^\/(css\/style\.css|js\/app\.js|hero_student\.png)$/
        .test(pathname)
    ) {
      return path.join(
        ROOT,
        pathname.slice(1)
      );
    }

    if (
      /^\/assets\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp|svg)$/
        .test(pathname)
    ) {
      return path.join(
        ROOT,
        pathname.slice(1)
      );
    }

    return null;
  };


async function serveStatic(
  req,
  res,
  pathname
) {

  const file =
    allowedFile(
      decodeURIComponent(
        pathname
      )
    );

  if (!file) {
    return sendJson(
      res,
      404,
      {
        error:
          'Not found.'
      }
    );
  }

  try {

    const body =
      await fs.readFile(
        file
      );

    const ext =
      path.extname(
        file
      ).toLowerCase();

    const contentType = {
      '.html':
        'text/html; charset=utf-8',

      '.css':
        'text/css; charset=utf-8',

      '.js':
        'text/javascript; charset=utf-8',

      '.png':
        'image/png',

      '.jpg':
        'image/jpeg',

      '.jpeg':
        'image/jpeg',

      '.webp':
        'image/webp',

      '.svg':
        'image/svg+xml'
    }[ext] ||
      'application/octet-stream';

    res.writeHead(
      200,
      {
        'Content-Type':
          contentType,

        'X-Content-Type-Options':
          'nosniff',

        'Referrer-Policy':
          'same-origin',

        'X-Frame-Options':
          'DENY',

        'Cache-Control':
          ext === '.html'
            ? 'no-store'
            : 'public, max-age=3600'
      }
    );

    res.end(body);

  } catch {
    sendJson(
      res,
      404,
      {
        error:
          'Not found.'
      }
    );
  }
}


/* =========================================================
   REQUEST HANDLER
   ========================================================= */

async function requestHandler(
  req,
  res
) {

  try {

    const url =
      new URL(
        req.url,
        `http://${req.headers.host || 'localhost'}`
      );

    /*
     * API REQUESTS
     */
    if (
      url.pathname.startsWith(
        '/api/'
      )
    ) {
      return await handleApi(
        req,
        res,
        url
      );
    }


    /*
     * STATIC FILE REQUESTS
     */
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD'
    ) {
      return sendJson(
        res,
        405,
        {
          error:
            'Method not allowed.'
        }
      );
    }

    return await serveStatic(
      req,
      res,
      url.pathname
    );

  } catch (error) {

    console.error(
      'Request failed:',
      error.message
    );

    if (!res.headersSent) {

      sendJson(
        res,
        error.status || 500,
        {
          error:
            error.status
              ? error.message
              : 'Server error.'
        }
      );

    } else {

      res.end();

    }
  }
}


/* =========================================================
   VERCEL EXPORT
   ========================================================= */

module.exports =
  requestHandler;


/* =========================================================
   LOCAL DEVELOPMENT SERVER
   =========================================================

   This section runs ONLY when you execute:

       npm start

   It does NOT run when Vercel imports this file.
   ========================================================= */

if (
  require.main === module
) {

  const server =
    http.createServer(
      requestHandler
    );

  server.listen(
    PORT,
    () => {

      if (
        !process.env.ADMIN_USERNAME ||
        !verifyAdminPasswordHash()
      ) {
        console.warn(
          'Admin login disabled: configure ADMIN_USERNAME and ADMIN_PASSWORD_HASH.'
        );
      }

      console.log(
        `Aatma Deepo Bhava is running at http://localhost:${PORT}`
      );
    }
  );
}