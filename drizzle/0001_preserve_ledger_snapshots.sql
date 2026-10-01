CREATE TABLE IF NOT EXISTS ledger_snapshots (
  owner TEXT NOT NULL,
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated TEXT NOT NULL,
  PRIMARY KEY (owner, revision)
);
-- Preserve every existing ledger before the additive accounting migration runs.
INSERT OR IGNORE INTO ledger_snapshots (owner, revision, payload, updated)
SELECT owner, revision, payload, updated FROM ledger;
