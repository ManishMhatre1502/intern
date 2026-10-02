'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');

const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');

async function readHidden(promptText) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') throw new Error('Run this setup directly in a terminal so the password can stay hidden.');
  process.stdout.write(promptText);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error, result) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      process.stdout.write('\n');
      error ? reject(error) : resolve(result);
    };
    const onData = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Setup cancelled.'));
        if (character === '\r' || character === '\n') return finish(null, value);
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  if (!process.stdin.isTTY) throw new Error('Run `npm run setup-admin` in an interactive terminal.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = (process.argv[2] || await rl.question('Admin username: ')).trim();
  rl.close();
  if (username.length < 2 || username.length > 100 || /[\r\n]/.test(username)) throw new Error('Enter a username between 2 and 100 characters.');

  const password = await readHidden('Choose admin password (at least 10 characters; input hidden): ');
  const confirmation = await readHidden('Confirm admin password (input hidden): ');
  if (password.length < 10 || password.length > 200) throw new Error('Password must be between 10 and 200 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match. No configuration was written.');

  const salt = crypto.randomBytes(16);
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derived) => error ? reject(error) : resolve(derived.toString('hex')));
  });
  const passwordHash = `scrypt$${salt.toString('hex')}$${hash}`;
  let existing = '';
  try { existing = await fs.readFile(envPath, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const retained = existing.split(/\r?\n/).filter(line => !/^\s*(ADMIN_USERNAME|ADMIN_PASSWORD_HASH)\s*=/.test(line) && line.length);
  retained.push(`ADMIN_USERNAME=${JSON.stringify(username)}`, `ADMIN_PASSWORD_HASH=${JSON.stringify(passwordHash)}`);
  await fs.writeFile(envPath, `${retained.join('\n')}\n`, { mode: 0o600 });
  await fs.chmod(envPath, 0o600);
  process.stdout.write('Admin credentials saved to the ignored .env file. Restart the website with `npm start` to enable admin login.\n');
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
