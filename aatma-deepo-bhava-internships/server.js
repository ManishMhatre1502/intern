'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getCollections, findSession, removeSession, rateLimitExceeded, saveSession } = require('./storage');
const { sendOfferLetter, sendCompletionDocuments } = require('./documents');

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

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readRawBody(req);
  try {
    return JSON.parse(raw.toString('utf8') || '{}');
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

const INTERNSHIP_FEE_PAISE = 100000;
const DOCUMENT_LOCK_MS = 10 * 60 * 1000;

function timingSafeTextMatch(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function hmacHex(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

async function createRazorpayOrder(enrollment, account) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw Object.assign(new Error('Razorpay is not configured on the server.'), { status: 503 });
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: INTERNSHIP_FEE_PAISE,
      currency: 'INR',
      receipt: enrollment.id,
      notes: { enrollmentId: enrollment.id, studentId: account.id }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) {
    console.error('Razorpay order creation failed with HTTP', response.status);
    throw Object.assign(new Error('Could not start secure payment. Please try again.'), { status: 502 });
  }
  return { id: result.id, amount: result.amount, currency: result.currency };
}


async function verifyCapturedRazorpayPayment(paymentId, expectedOrderId) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !paymentId) throw Object.assign(new Error('Payment verification could not be completed.'), { status: 503 });
  const response = await fetch(\`https://api.razorpay.com/v1/payments/\${encodeURIComponent(paymentId)}\`, {
    headers: { Authorization: \`Basic \${Buffer.from(\`\${keyId}:\${keySecret}\`).toString('base64')}\` }
  });
  const payment = await response.json().catch(() => ({}));
  if (!response.ok || payment.order_id !== expectedOrderId || payment.status !== 'captured' ||
      payment.amount !== INTERNSHIP_FEE_PAISE || payment.currency !== 'INR') {
    throw Object.assign(new Error('Payment is not captured for this enrollment yet.'), { status: 409 });
  }
  return payment;
}

async function issueOfferLetter(enrollmentId) {
  const { accounts, enrollments } = await getCollections();
  const now = new Date();
  const lockExpiry = new Date(now.getTime() - DOCUMENT_LOCK_MS);
  const claim = await enrollments.updateOne({
    id: enrollmentId,
    paymentStatus: 'Paid',
    offerLetterSent: { $ne: true },
    $or: [{ offerLetterSending: { $ne: true } }, { offerLetterSendingAt: { $lt: lockExpiry } }]
  }, { $set: { offerLetterSending: true, offerLetterSendingAt: now } });
  if (!claim.modifiedCount) return false;
  try {
    const enrollment = await enrollments.findOne({ id: enrollmentId });
    const student = await accounts.findOne({ id: enrollment.userId });
    if (!student) throw new Error('Student account not found for enrollment.');
    await sendOfferLetter({ enrollment, student });
    await enrollments.updateOne({ id: enrollmentId }, {
      $set: { offerLetterSent: true, offerLetterSentAt: new Date() },
      $unset: { offerLetterSending: '', offerLetterSendingAt: '' }
    });
    return true;
  } catch (error) {
    await enrollments.updateOne({ id: enrollmentId }, {
      $unset: { offerLetterSending: '', offerLetterSendingAt: '' }
    });
    throw error;
  }
}

async function markEnrollmentPaid(enrollment, paymentId) {
  const { accounts, enrollments } = await getCollections();
  if (enrollment.paymentStatus !== 'Paid') {
    const paidAt = new Date();
    const start = new Date(paidAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dateOnly = date => date.toISOString().slice(0, 10);
    await enrollments.updateOne(
      { id: enrollment.id, paymentStatus: { $ne: 'Paid' } },
      { $set: {
        paymentStatus: 'Paid',
        razorpayPaymentId: paymentId,
        paidAt: paidAt.toISOString(),
        startDate: dateOnly(start),
        endDate: dateOnly(end)
      } }
    );
  }
  let updated = await enrollments.findOne({ id: enrollment.id });
  if (updated && updated.paymentStatus === 'Paid' && updated.offerLetterSent !== true) {
    try {
      await issueOfferLetter(updated.id);
    } catch (error) {
      console.error('Offer letter delivery is pending:', error.message);
    }
    updated = await enrollments.findOne({ id: enrollment.id });
  }
  return updated;
}

async function issueCompletionDocuments(enrollmentId, appreciationRequested) {
  const { accounts, enrollments, taskSubmissions } = await getCollections();
  const now = new Date();
  const lockExpiry = new Date(now.getTime() - DOCUMENT_LOCK_MS);
  const claim = await enrollments.updateOne({
    id: enrollmentId,
    paymentStatus: 'Paid',
    $or: [{ documentsSending: { $ne: true } }, { documentsSendingAt: { $lt: lockExpiry } }]
  }, { $set: { documentsSending: true, documentsSendingAt: now } });
  if (!claim.modifiedCount) throw Object.assign(new Error('Documents are already being prepared. Refresh and try again shortly.'), { status: 409 });

  try {
    const enrollment = await enrollments.findOne({ id: enrollmentId });
    const approvedWeeks = await taskSubmissions.distinct('week', { enrollmentId, status: 'Approved' });
    if (new Set(approvedWeeks).size < 4) {
      throw Object.assign(new Error('All four weekly tasks must be approved before issuing completion documents.'), { status: 409 });
    }
    const student = await accounts.findOne({ id: enrollment.userId });
    if (!student) throw new Error('Student account not found for enrollment.');
    const includeCompletion = enrollment.completionCertificateSent !== true;
    const includeAppreciation = appreciationRequested && enrollment.appreciationLetterSent !== true;
    if (!includeCompletion && !includeAppreciation) {
      return { completionCertificateSent: true, appreciationLetterSent: enrollment.appreciationLetterSent === true, alreadySent: true };
    }
    await sendCompletionDocuments({ enrollment, student, includeCompletion, includeAppreciation });
    const set = {};
    if (includeCompletion) {
      set.completionCertificateSent = true;
      set.completionCertificateSentAt = new Date();
    }
    if (includeAppreciation) {
      set.appreciationLetterSent = true;
      set.appreciationLetterSentAt = new Date();
    }
    await enrollments.updateOne({ id: enrollmentId }, { $set: set });
    return {
      completionCertificateSent: includeCompletion || enrollment.completionCertificateSent === true,
      appreciationLetterSent: includeAppreciation || enrollment.appreciationLetterSent === true,
      alreadySent: false
    };
  } finally {
    await enrollments.updateOne({ id: enrollmentId }, {
      $unset: { documentsSending: '', documentsSendingAt: '' }
    });
  }
}

function getEnrollmentStatus(enrollment, today = new Date().toISOString().slice(0, 10)) {
  if (enrollment.paymentStatus !== 'Paid') return 'Payment pending';
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
    if (!account) return sendJson(res, 401, { error: 'Your student account could not be found. Please sign in again.' });

    const createdAt = new Date();
    const enrollment = {
      id: `ADB-${createdAt.getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: account.id,
      title,
      enrolledAt: createdAt.toISOString(),
      startDate: null,
      endDate: null,
      paymentStatus: 'Pending',
      amountPaise: INTERNSHIP_FEE_PAISE,
      currency: 'INR',
      offerLetterSent: false,
      completionCertificateSent: false,
      appreciationLetterSent: false
    };
    const order = await createRazorpayOrder(enrollment, account);
    enrollment.razorpayOrderId = order.id;
    await enrollments.insertOne(enrollment);
    return sendJson(res, 201, {
      enrollment,
      checkout: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: process.env.ORGANIZATION_NAME || 'Aatma Deepo Bhava',
        description: title,
        prefill: { name: account.name, email: account.email, contact: account.mobile }
      }
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/payments/verify') {
    const session = await getSession(req);
    if (!session || session.role !== 'user') return sendJson(res, 401, { error: 'Please sign in before confirming payment.' });
    const body = await readJson(req);
    const enrollmentId = String(body.enrollmentId || '');
    const orderId = String(body.razorpay_order_id || '');
    const paymentId = String(body.razorpay_payment_id || '');
    const signature = String(body.razorpay_signature || '');
    const { enrollments } = await getCollections();
    const enrollment = await enrollments.findOne({ id: enrollmentId, userId: session.userId, razorpayOrderId: orderId });
    if (!enrollment) return sendJson(res, 404, { error: 'Enrollment payment could not be found.' });
    const expected = hmacHex(process.env.RAZORPAY_KEY_SECRET || '', `${orderId}|${paymentId}`);
    if (!process.env.RAZORPAY_KEY_SECRET || !timingSafeTextMatch(expected, signature)) {
      return sendJson(res, 400, { error: 'Payment verification failed. Contact support before retrying payment.' });
    }
    await verifyCapturedRazorpayPayment(paymentId, orderId);
    const updated = await markEnrollmentPaid(enrollment, paymentId);
    return sendJson(res, 200, {
      enrollment: updated,
      offerLetterSent: updated.offerLetterSent === true,
      offerLetterPending: updated.offerLetterSent !== true
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/webhooks/razorpay') {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return sendJson(res, 503, { error: 'Payment webhook is not configured.' });
    const raw = await readRawBody(req);
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const expected = hmacHex(secret, raw);
    if (!timingSafeTextMatch(expected, signature)) return sendJson(res, 401, { error: 'Invalid payment webhook signature.' });
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch { return sendJson(res, 400, { error: 'Invalid webhook body.' }); }
    let orderId = '';
    let paymentId = '';
    if (event.event === 'payment.captured') {
      orderId = event.payload?.payment?.entity?.order_id || '';
      paymentId = event.payload?.payment?.entity?.id || '';
    } else if (event.event === 'order.paid') {
      orderId = event.payload?.order?.entity?.id || '';
      paymentId = event.payload?.payment?.entity?.id || '';
    } else {
      return sendJson(res, 200, { received: true, ignored: true });
    }
    if (!orderId) return sendJson(res, 400, { error: 'Payment webhook is missing an order ID.' });
    const { enrollments } = await getCollections();
    const enrollment = await enrollments.findOne({ razorpayOrderId: orderId });
    if (!enrollment) return sendJson(res, 200, { received: true, ignored: true });
    await markEnrollmentPaid(enrollment, paymentId || 'captured');
    return sendJson(res, 200, { received: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/webhooks/google-forms') {
    const secret = process.env.GOOGLE_FORMS_WEBHOOK_SECRET;
    const authHeader = String(req.headers.authorization || '');
    const presentedSecret = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (!secret || !timingSafeTextMatch(presentedSecret, secret)) {
      return sendJson(res, 401, { error: 'Invalid task webhook authorization.' });
    }
    const body = await readJson(req);
    const responseId = String(body.responseId || '').trim();
    const studentEmail = String(body.studentEmail || '').trim().toLowerCase();
    const enrollmentId = String(body.enrollmentId || '').trim();
    const week = Number(body.week);
    const submissionUrl = String(body.submissionUrl || '').trim();
    const submittedAt = body.submittedAt ? new Date(body.submittedAt) : new Date();
    if (!responseId || responseId.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail) ||
        !Number.isInteger(week) || week < 1 || week > 4 || !enrollmentId || enrollmentId.length > 80 ||
        !Number.isFinite(submittedAt.getTime()) || submissionUrl.length > 2048) {
      return sendJson(res, 400, { error: 'Provide a valid response ID, student email, enrollment ID, week 1-4, submission URL, and timestamp.' });
    }
    let parsedSubmission;
    try { parsedSubmission = new URL(submissionUrl); } catch { return sendJson(res, 400, { error: 'Submission URL must be a valid HTTPS link.' }); }
    if (parsedSubmission.protocol !== 'https:') return sendJson(res, 400, { error: 'Submission URL must be a valid HTTPS link.' });

    const { accounts, enrollments, taskSubmissions } = await getCollections();
    const account = await accounts.findOne({ email: studentEmail }, { projection: { id: 1 } });
    const enrollment = account && await enrollments.findOne({ id: enrollmentId, userId: account.id, paymentStatus: 'Paid' });
    if (!account || !enrollment) return sendJson(res, 404, { error: 'No paid enrollment matches that student and enrollment ID.' });
    const existingResponse = await taskSubmissions.findOne({ responseId }, { projection: { id: 1, enrollmentId: 1 } });
    if (existingResponse) return sendJson(res, 200, { accepted: true, duplicate: true });
    const submission = {
      id: `${enrollmentId}:week:${week}`,
      responseId,
      studentId: account.id,
      studentEmail,
      enrollmentId,
      domain: enrollment.title,
      week,
      submissionUrl,
      notes: String(body.notes || '').slice(0, 2000),
      formId: String(body.formId || '').slice(0, 200),
      submittedAt: submittedAt.toISOString(),
      status: 'Pending',
      feedback: '',
      reviewedAt: null,
      reviewedBy: null
    };
    try {
      await taskSubmissions.updateOne({ enrollmentId, week }, { $set: submission }, { upsert: true });
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      return sendJson(res, 200, { accepted: true, duplicate: true });
    }
    return sendJson(res, 201, { accepted: true, week, enrollmentId });
  }

  const adminEnrollmentAction = url.pathname.split('/');
  if (req.method === 'POST' && adminEnrollmentAction.length === 6 && adminEnrollmentAction[1] === 'api' && adminEnrollmentAction[2] === 'admin' && adminEnrollmentAction[3] === 'enrollments' && ['offer-letter', 'completion-certificate', 'appreciation-letter'].includes(adminEnrollmentAction[5])) {
    const session = await getSession(req);
    if (!session || session.role !== 'admin') return sendJson(res, 401, { error: 'Administrator access is required.' });
    const enrollmentId = decodeURIComponent(adminEnrollmentAction[4]);
    const action = adminEnrollmentAction[5];
    const { enrollments } = await getCollections();
    const enrollment = await enrollments.findOne({ id: enrollmentId });
    if (!enrollment) return sendJson(res, 404, { error: 'Enrollment not found.' });
    if (action === 'offer-letter') {
      if (enrollment.paymentStatus !== 'Paid') return sendJson(res, 409, { error: 'An offer letter can only be sent after payment is verified.' });
      if (enrollment.offerLetterSent) return sendJson(res, 200, { sent: true, alreadySent: true });
      const sent = await issueOfferLetter(enrollmentId);
      if (!sent) return sendJson(res, 409, { error: 'The offer letter is already being sent. Refresh shortly.' });
      return sendJson(res, 200, { sent: true });
    }
    const result = await issueCompletionDocuments(enrollmentId, action === 'appreciation-letter');
    return sendJson(res, 200, { sent: true, ...result });
  }

  const taskReviewRoute = url.pathname.split('/');
  if (req.method === 'PATCH' && taskReviewRoute.length === 6 && taskReviewRoute[1] === 'api' && taskReviewRoute[2] === 'admin' && taskReviewRoute[3] === 'task-submissions' && taskReviewRoute[5] === 'review') {
    const session = await getSession(req);
    if (!session || session.role !== 'admin') return sendJson(res, 401, { error: 'Administrator access is required.' });
    const body = await readJson(req);
    const status = String(body.status || '');
    const feedback = String(body.feedback || '').trim();
    if (!['Approved', 'Needs changes'].includes(status) || feedback.length > 2000) {
      return sendJson(res, 400, { error: 'Choose Approved or Needs changes and keep feedback under 2,000 characters.' });
    }
    const { taskSubmissions } = await getCollections();
    const id = decodeURIComponent(taskReviewRoute[4]);
    const result = await taskSubmissions.updateOne({ id }, {
      $set: { status, feedback, reviewedAt: new Date().toISOString(), reviewedBy: session.username }
    });
    if (!result.matchedCount) return sendJson(res, 404, { error: 'Task submission not found.' });
    return sendJson(res, 200, { updated: true });
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
    if (!session || session.role !== 'admin') return sendJson(res, 401, { error: 'Administrator access is required.' });
    const { accounts, enrollments, taskSubmissions } = await getCollections();
    const [accountList, enrollmentList, submissions] = await Promise.all([
      accounts.find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, mobile: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray(),
      enrollments.find({}, { projection: {
        _id: 0, id: 1, userId: 1, title: 1, enrolledAt: 1, startDate: 1, endDate: 1,
        paymentStatus: 1, paidAt: 1, offerLetterSent: 1, completionCertificateSent: 1,
        appreciationLetterSent: 1
      } }).sort({ enrolledAt: -1 }).toArray(),
      taskSubmissions.find({}, { projection: {
        _id: 0, id: 1, studentId: 1, studentEmail: 1, enrollmentId: 1, domain: 1,
        week: 1, submissionUrl: 1, notes: 1, submittedAt: 1, status: 1, feedback: 1, reviewedAt: 1
      } }).sort({ submittedAt: -1 }).toArray()
    ]);
    const accountById = new Map(accountList.map(account => [account.id, account]));
    const tasksByEnrollment = new Map();
    for (const task of submissions) {
      const list = tasksByEnrollment.get(task.enrollmentId) || [];
      list.push(task);
      tasksByEnrollment.set(task.enrollmentId, list);
    }
    const enrichedSubmissions = submissions.map(submission => ({
      ...submission,
      studentName: accountById.get(submission.studentId)?.name || 'Unknown student'
    }));
    const enrichedEnrollments = enrollmentList.map(enrollment => {
      const student = accountById.get(enrollment.userId);
      const tasks = tasksByEnrollment.get(enrollment.id) || [];
      const approvedWeeks = [...new Set(tasks.filter(task => task.status === 'Approved').map(task => task.week))].sort();
      return {
        ...enrollment,
        studentName: student?.name || 'Unknown student',
        studentEmail: student?.email || '',
        status: getEnrollmentStatus(enrollment),
        approvedWeeks,
        taskSubmissions: tasks
      };
    });
    const enrollmentsByUser = new Map();
    for (const enrollment of enrichedEnrollments) {
      const list = enrollmentsByUser.get(enrollment.userId) || [];
      list.push(enrollment);
      enrollmentsByUser.set(enrollment.userId, list);
    }
    const students = accountList.map(account => ({
      ...safeAccount(account),
      internships: enrollmentsByUser.get(account.id) || []
    }));
    const paidStudents = students.filter(student => student.internships.some(item => item.paymentStatus === 'Paid')).length;
    return sendJson(res, 200, {
      summary: {
        totalStudents: students.length,
        internshipStudents: paidStudents,
        notStarted: students.length - paidStudents
      },
      students,
      enrollments: enrichedEnrollments,
      taskSubmissions: enrichedSubmissions
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
