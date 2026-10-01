# Private cloud ledger
Owner: alfonso.locsin@gmail.com. Sites owner-only access and trusted platform identity headers protect the application. Financial records use D1 and receipts use R2. The application does not use Firebase.

Cloud saves use a revision check to prevent overwriting changes from another device. If a conflict is shown, download the draft backup before loading the latest cloud records. Backups include receipt bytes.

Build: node build-local.mjs. Type check: node node_modules/typescript/bin/tsc --noEmit. Tests: node --import ./tests/typescript-loader.mjs --experimental-test-isolation=none --test tests/*.test.ts tests/*.test.mjs.

Initial schema was generated using drizzle-kit API because Windows blocks the CLI esbuild subprocess. Existing migrations must never be edited after deployment.
