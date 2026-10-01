import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_EMAIL, isOwnerAccount } from '../src/utils/access.ts';

const owner = { email: ALLOWED_EMAIL, emailVerified: true, providerData: [{ providerId: 'google.com' }] };
test('only the verified Google owner may open the ledger', () => {
  assert.equal(isOwnerAccount(owner), true);
  assert.equal(isOwnerAccount({ ...owner, email: ALLOWED_EMAIL.toUpperCase() }), true);
  assert.equal(isOwnerAccount(null), false);
  assert.equal(isOwnerAccount({ ...owner, email: 'another@gmail.com' }), false);
  assert.equal(isOwnerAccount({ ...owner, email: null }), false);
  assert.equal(isOwnerAccount({ ...owner, emailVerified: false }), false);
  assert.equal(isOwnerAccount({ ...owner, providerData: [{ providerId: 'password' }] }), false);
});
