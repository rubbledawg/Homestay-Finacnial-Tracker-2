# Airbnb finance tracker — first repair pass

This project preserves the existing compact ledger, bookings, partners, exports and PHP currency interface. It has not been deployed. Your original ZIP is unchanged.

## Changes

- The ledger mounts only after the verified Google owner account signs in. Signed-out and other-account sessions see a sign-in screen instead of browser-cached finances.
- Owner: alfonso.locsin@gmail.com. Firestore rules now require this verified Google account as well as the matching user ID. These rules must be deployed to take effect on the server.
- Failed cloud reads propagate errors instead of appearing to be an empty account and triggering an upload. Failed initial uploads no longer report successful synchronization.
- Switching property or year resets the hydration guard. Superseded initialization reads stop before continuing.
- An intentionally emptied cloud year no longer automatically gets replaced with older local entries.
- Backup uploads no longer delete cloud properties merely because they are absent on the current device.
- Coalesced save failures reject every waiting caller; cancelling queued saves also settles their promises.
- The default year follows the current date, with validation of the saved year.
- Firebase Hosting configuration targets the existing configured project and database.

## Validation

TypeScript check passed. Owner-access regression test passed (owner, other email, signed out, missing email, unverified email and non-Google provider).

The production build was attempted but the local execution environment blocked the build helper process with `spawn EPERM`. No browser layout check, live Google sign-in test, deployed security-rule test or two-device sync test has been completed. Do not treat this as a production-ready release yet.

## Run and publish

Use Node.js 24 and pnpm. From this project folder:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm dev
```

In the Firebase console, verify that the project and database match `firebase-applet-config.json`. Enable Google under Authentication → Sign-in method. Add localhost for development and the final hosting domain to Authentication → Settings → Authorized domains.

After a successful build and review, use the Firebase CLI signed in to the project owner account:

```text
firebase login
firebase deploy --only firestore:rules,hosting
```

The saved `.firebaserc` identifies the existing project. Review this before deployment; deploying Hosting replaces the site's current hosted version. Firebase hosting configuration reference: https://firebase.google.com/docs/hosting/full-config

## Remaining work before release

- Test deployed rules with the owner, a different Google account and no account. Client-side gating alone does not protect cloud data.
- Test save, refresh, sign-out and sign-in on two devices, including offline edits and conflicting edits. The existing whole-year document model can overwrite concurrent edits; it needs further work before reliable simultaneous editing.
- Move receipt images from embedded year documents into a separate file store. Large receipt collections can exceed Firestore's document size limit.
- Review backup import/export and deletion flows: some still assume years 2024–2027 and suppress partial errors.
- Review the accounting definitions with the owner: the existing app counts injected capital in the displayed net profit. This calculation was preserved pending a decision on the intended meaning.
- Verify desktop and mobile layout and exports after building.
- Browser-local data is retained on sign-out for recovery. The sign-in screen hides it in the app, but it is not encrypted storage for a shared computer.

Export a backup from the existing app before migrating real records. Browser storage belongs to each website address, so a newly hosted address cannot automatically read the original Google Studio app's local records.
