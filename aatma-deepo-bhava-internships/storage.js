'use strict';

const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');

let clientPromise;
let collectionsPromise;

function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
      serverSelectionTimeoutMS: 10000
    });
    clientPromise = client.connect().catch(error => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

async function getCollections() {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const client = await getMongoClient();
      const db = client.db(
        process.env.MONGODB_DB || 'aatma_deepo_bhava'
      );
      const accounts = db.collection('accounts');
      const enrollments = db.collection('enrollments');
      const sessions = db.collection('sessions');
      const rateLimits = db.collection('rate_limits');

      await Promise.all([
        accounts.createIndex(
          { email: 1 },
          { unique: true, name: 'accounts_email_unique' }
        ),
        accounts.createIndex(
          { id: 1 },
          { unique: true, name: 'accounts_id_unique' }
        ),
        enrollments.createIndex(
          { id: 1 },
          { unique: true, name: 'enrollments_id_unique' }
        ),
        enrollments.createIndex(
          { userId: 1, enrolledAt: -1 },
          { name: 'enrollments_user_recent' }
        ),
        sessions.createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: 'sessions_expiry' }
        ),
        rateLimits.createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: 'rate_limits_expiry' }
        )
      ]);

      return { accounts, enrollments, sessions, rateLimits };
    })().catch(error => {
      collectionsPromise = undefined;
      throw error;
    });
  }

  return collectionsPromise;
}


async function rateLimitExceeded(req, key, limit = 10, windowMs = 15 * 60 * 1000) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const id = crypto.createHash('sha256')
    .update(`${key}:${clientIp}`)
    .digest('hex');
  const { rateLimits } = await getCollections();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const update = [{
    $set: {
      count: {
        $cond: [
          { $gt: ['$expiresAt', now] },
          { $add: [{ $ifNull: ['$count', 0] }, 1] },
          1
        ]
      },
      expiresAt: {
        $cond: [
          { $gt: ['$expiresAt', now] },
          '$expiresAt',
          resetAt
        ]
      }
    }
  }];

  try {
    await rateLimits.updateOne({ _id: id }, update, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await rateLimits.updateOne({ _id: id }, update);
  }
  const record = await rateLimits.findOne({ _id: id }, { projection: { count: 1 } });
  return record.count > limit;
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function saveSession(token, identity, expiresAt) {
  const { sessions } = await getCollections();
  const _id = hashSessionToken(token);
  await sessions.insertOne({ _id, ...identity, expiresAt: new Date(expiresAt) });
}

async function findSession(token) {
  if (!token) return null;
  const { sessions } = await getCollections();
  const session = await sessions.findOne({ _id: hashSessionToken(token) });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await sessions.deleteOne({ _id: session._id });
    return null;
  }
  return session;
}

async function removeSession(token) {
  if (!token) return;
  const { sessions } = await getCollections();
  await sessions.deleteOne({ _id: hashSessionToken(token) });
}

module.exports = {
  getCollections,
  findSession,
  removeSession,
  rateLimitExceeded,
  saveSession
};
