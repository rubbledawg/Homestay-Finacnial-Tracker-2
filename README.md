# Homestay Financial Tracker

Private rental-property finance ledger with a dark interface, bookings, income and expenses, partner shares, receipt attachments, annual summaries and backup/export tools.

Live app: https://private-property-ledger.alfonso-locsin.chatgpt.site

The cloud edition uses Sites owner-only authentication, D1 for records and R2 for receipts. Financial records are stored separately from this repository. Original Firebase modules are retained but inactive; Firebase configuration here is a placeholder.

## Development
Clone this private repository on either computer, install Node.js and pnpm, then run `pnpm install`, `pnpm run lint`, `pnpm run test` and `pnpm run build`.

The build produces dist/client, dist/server/index.js, a hosting manifest and database migrations. Vite alone does not provide the authenticated cloud API; use the Sites workflow to preview and publish cloud changes. See CLOUD_EDITION.md for details.

Never commit financial backups, receipts, credentials or build archives. Never edit migrations that have already been deployed.
