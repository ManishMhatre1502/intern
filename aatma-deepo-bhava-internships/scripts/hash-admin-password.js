'use strict';

const crypto = require('node:crypto');

if (!process.stdin.isTTY) {
  console.error('Run this command in an interactive terminal so the password is not echoed.');
  process.exit(1);
}

const stdin = process.stdin;
const salt = crypto.randomBytes(16).toString('hex');
let password = '';
process.stdout.write('Admin password (input hidden): ');
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');

stdin.on('data', chunk => {
  for (const character of chunk) {
    if (character === '\u0003') process.exit(1);
    if (character === '\r' || character === '\n') {
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
      if (password.length < 10) {
        console.error('Use at least 10 characters.');
        process.exit(1);
      }
      crypto.scrypt(password, Buffer.from(salt, 'hex'), 64, (error, derived) => {
        password = '';
        if (error) {
          console.error('Could not create password hash.');
          process.exit(1);
        }
        console.log(`scrypt$${salt}$${derived.toString('hex')}`);
      });
      return;
    }
    if (character === '\u007f' || character === '\b') password = password.slice(0, -1);
    else if (character >= ' ') password += character;
  }
});
