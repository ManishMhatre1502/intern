# Secure login setup

The site must be opened through `server.js`; opening `index.html` directly will not enable account or admin authentication.

1. Use Node.js 18 or newer.
2. Run the setup command in an interactive terminal. The password prompt is hidden, and the resulting credentials are stored in the ignored `.env` file with owner-only permissions:

   ```sh
   npm run setup-admin -- radhika
   ```

   Replace `radhika` with the desired admin username. The script asks you to enter and confirm a password of at least 10 characters. The password and its hash are never printed.
3. Start or restart the site after setup:

   ```sh
   npm start
   ```

   Visit `http://localhost:3000`. The server reads `.env` at startup; environment variables already provided by the hosting environment take precedence.
4. For a public deployment, use HTTPS and set `NODE_ENV=production`. The session cookie is then marked `Secure`.

User and admin passwords are salted and hashed with scrypt on the server and are never sent back to the browser. Account records and internship enrollments are stored under `data/` with restrictive file permissions. Admin dashboard data endpoints check the server-side admin session on every request. Keep `.env` and `data/` out of source control and backups accessible to untrusted users.
