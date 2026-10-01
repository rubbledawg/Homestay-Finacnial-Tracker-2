# Airbnb Ledger — standalone Windows edition

## Open the app

1. Extract the entire ZIP to a folder on your computer.
2. Double-click **Start Ledger.cmd**.
3. Your browser opens the ledger. Keep the launcher window open while using it; close it when finished.

No Google login, Firebase setup, internet connection or development-tool installation is needed for the portable edition. The included Node runtime serves only this app on this computer at http://127.0.0.1:4317.

If the launcher reports that the app is already open, visit that address. Use the same browser and profile each time. Do not use a private/incognito window for records you want to keep.

## Your records

Edits are saved in browser storage on this computer, not inside this app folder. **Backup → Download backup** creates a separate JSON file containing your properties, all saved years, partners and receipt attachments. Keep regular backup copies. Clearing browser/site data removes local records, and copying this app folder alone does not copy them.

To bring over records from your old app, download its JSON backup and use **Backup → Restore a backup file** here. Review the restore prompt before applying it. Use a backup when switching browsers or computers. Firebase and multi-device syncing are deferred.

This local edition has no sign-in screen. Anyone using your browser profile can open it. It is intended for your own computer.

## What changed

- Removed Google sign-in and Firebase initialization from the running app.
- Replaced cloud controls with local backup and restore.
- Preserved the compact ledger, bookings, partners, carryovers and export tools.
- Backups now include saved years beyond 2024–2027.
- Removed automatic filtering of entries based on old sample/statement IDs.
- Invalid backup structures are rejected before record writes; restored properties are removed from the deleted-property list.
- Removed external Google font downloads; the app uses local font fallbacks.

## Checks and limits

Production build and TypeScript checks passed. Regression checks passed for backup/restore, future years, receipt preservation and invalid backup rejection. The ledger and backup dialog were checked in the browser. Full PDF/JPEG export and large-data testing remain to be done.

This version uses the original browser-storage approach, which has limited capacity, particularly with many receipt images. A disk-backed database can be a later improvement. The original accounting definitions are preserved, including capital injections in the displayed net profit; review that definition before relying on profit distributions.

For development, use Node 24 and pnpm: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`. Cloud-related source files remain for later work but are not imported by the local application. Do not follow the earlier cloud deployment notes for this local edition.
