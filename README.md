# Homestay Financial Tracker

Private rental-property finance ledger with a dark interface, bookings, income and expenses, partner shares, receipt attachments, annual summaries and backup/export tools.

Live app: https://private-property-ledger.alfonso-locsin.chatgpt.site

The cloud edition uses Sites owner-only authentication, D1 for records and R2 for receipts. Financial records are stored separately from this repository. Original Firebase modules are retained but inactive; Firebase configuration here is a placeholder.

## Development
Use this project folder as the working copy. Install dependencies with `pnpm install`, then use `pnpm run lint`, `pnpm run test` and `pnpm run build` for validation.

Run `node preview-local.mjs` to open the local app at http://127.0.0.1:3000. It binds only to this computer and uses the ignored `.sites-runtime/preview-ledger.json` snapshot. The visible banner identifies its source date. Local changes do not update the cloud ledger. An absent snapshot starts an empty local workspace.

The build produces dist/client, dist/server/index.js, a hosting manifest and database migrations. Vite alone does not provide the authenticated cloud API; use the Sites workflow to preview and publish cloud changes. See CLOUD_EDITION.md for details.

Never commit financial backups, receipts, credentials or build archives. Never edit migrations that have already been deployed.

See ACCOUNTING_REVIEW.md for the accounting rules, migration safeguards and current publication status.
