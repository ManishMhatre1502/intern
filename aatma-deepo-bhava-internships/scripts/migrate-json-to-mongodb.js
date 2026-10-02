'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { MongoClient } = require('mongodb');

const ROOT = path.resolve(__dirname, '..');

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

async function readJsonArray(file) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(value)) throw new Error(`${path.basename(file)} must contain a JSON array.`);
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function importRecords(collection, records, key) {
  let inserted = 0;
  let skipped = 0;
  for (const record of records) {
    if (!record || typeof record !== 'object' || !record[key]) {
      throw new Error(`A source record is missing its ${key} field.`);
    }
    try {
      await collection.insertOne(record);
      inserted += 1;
    } catch (error) {
      if (error.code !== 11000) throw error;
      skipped += 1;
    }
  }
  return { inserted, skipped };
}

async function main() {
  loadLocalEnvironment();
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env before migrating.');
  const accounts = await readJsonArray(path.join(ROOT, 'data', 'accounts.json'));
  const enrollments = await readJsonArray(path.join(ROOT, 'data', 'enrollments.json'));
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'aatma_deepo_bhava');
    const accountCollection = db.collection('accounts');
    const enrollmentCollection = db.collection('enrollments');
    await Promise.all([
      accountCollection.createIndex({ email: 1 }, { unique: true, name: 'accounts_email_unique' }),
      accountCollection.createIndex({ id: 1 }, { unique: true, name: 'accounts_id_unique' }),
      enrollmentCollection.createIndex({ id: 1 }, { unique: true, name: 'enrollments_id_unique' }),
      enrollmentCollection.createIndex({ userId: 1, enrolledAt: -1 }, { name: 'enrollments_user_recent' })
    ]);
    const accountResult = await importRecords(accountCollection, accounts, 'email');
    const enrollmentResult = await importRecords(enrollmentCollection, enrollments, 'id');
    process.stdout.write(
      `Accounts: ${accountResult.inserted} inserted, ${accountResult.skipped} skipped.\n` +
      `Enrollments: ${enrollmentResult.inserted} inserted, ${enrollmentResult.skipped} skipped.\n`
    );
  } finally {
    await client.close();
  }
}

main().catch(error => {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  process.exitCode = 1;
});
