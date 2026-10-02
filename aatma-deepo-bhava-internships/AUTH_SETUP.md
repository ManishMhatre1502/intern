# Authentication and deployment setup

The site must be opened through `server.js`; opening `index.html` directly will not enable account or admin authentication. The same handler runs locally and as a Vercel Function. Account, enrollment, and session records are stored in MongoDB so they persist across serverless invocations.

## Requirements

- Node.js 20 or newer.
- A MongoDB Atlas cluster (or another reachable MongoDB deployment).
- A MongoDB database user with read/write access to the application database.
- A MongoDB network access rule that permits the deployed Vercel functions to connect. Use the narrowest network policy available for your hosting plan.

## Local development

1. Copy `.env.example` to `.env` and fill in your MongoDB connection string. Keep `.env` private; it is ignored by Git.
2. Set an application admin username and password hash. For local development, use the interactive setup command below.
3. Install dependencies and start the site:

   ```sh
   npm install
   npm run setup-admin -- your-admin-username
   npm start
   ```

   The hidden password prompt saves `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` to the ignored `.env`. Environment variables supplied by the hosting environment take precedence over values in `.env`.

## Environment variables

Set these in Vercel under **Project Settings → Environment Variables** for the environments where the site will run:

- `MONGODB_URI` — required. Atlas connection string, kept secret.
- `MONGODB_DB` — optional. Database name; defaults to `aatma_deepo_bhava`.
- `ADMIN_USERNAME` — required to enable admin login.
- `ADMIN_PASSWORD_HASH` — required to enable admin login. Use the scrypt hash output from `npm run hash-admin-password` (or generate it with `npm run setup-admin` and copy the resulting hash from local `.env`). Never put the plain admin password in Vercel variables or source control.
- `NODE_ENV` — set to `production` for production; this enables the Secure cookie flag.

Set secrets in Vercel's environment-variable settings, not in `vercel.json`, source files, or GitHub. Redeploy after changing production environment variables.

## Existing local JSON data

If the local `data/accounts.json` or `data/enrollments.json` contains records to keep, configure `.env` to point at the target MongoDB database and run:

```sh
npm run migrate-json
```

The importer inserts existing records without replacing documents already present. Review its inserted/skipped counts before deploying. Keep a protected backup of the original JSON files until the migrated data has been checked. The application itself no longer reads or writes JSON data files.

## Deployment

Import the repository into Vercel with the project root set to `aatma-deepo-bhava-internships`. Vercel builds the static files and the existing `api/` function entry points. Configure all required environment variables above before promoting a deployment. Do not commit `.env`, production database credentials, or admin password hashes.
