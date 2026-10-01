import { cloudStore as localStorage, loadCloud, saveCloud } from '../src/lib/cloudStore';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyMonths } from '../src/utils/calculations';
import { exportFullFinancialBackup, importFullFinancialBackup, normalizeMonthData, STORAGE_KEY_BUSINESSES, STORAGE_KEY_DATA, STORAGE_KEY_DELETED_BIZ } from '../src/utils/dataRecovery';

test('backup preserves future years, receipts and legacy row IDs; invalid input does not change records', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    get length() { return store.size; }, key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)), removeItem: (key: string) => store.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } });
  globalThis.fetch = async (_input, init) => new Response(JSON.stringify(init?.body ? { revision: 1, values: JSON.parse(String(init.body)).values } : { revision: 0, values: {} }));
  await loadCloud();
  const biz = { id: 'test-property', name: 'Test property', category: '', currency: 'PHP', description: '', createdAt: 1 };
  const months = createEmptyMonths(2030);
  months[6].ledger.push({ id: 'jul-stmt-real', date: '2030-07-01', type: 'Expense', description: 'Repair', category: 'Maintenance & Repairs', receiptNo: '', inflow: '', outflow: 123, notes: '', attachments: [{ id: 'receipt', url: 'data:image/png;base64,TEST', name: 'receipt.png' }] });
  localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify([biz]));
  localStorage.setItem(`${STORAGE_KEY_DATA}_${biz.id}_2030`, JSON.stringify(months));
  const backup = exportFullFinancialBackup();
  assert.deepEqual(backup.data[biz.id].years[2030], months);
  assert.equal(normalizeMonthData(months, biz.id)[6].ledger.length, 1);
  const before = exportFullFinancialBackup().data;
  assert.equal(importFullFinancialBackup(JSON.stringify({ businesses: [biz], data: { [biz.id]: { partners: [], years: { 2030: [null] } } } })).success, false);
  assert.deepEqual(exportFullFinancialBackup().data, before);
  localStorage.setItem(STORAGE_KEY_DELETED_BIZ, JSON.stringify([biz.id]));
  localStorage.removeItem(`${STORAGE_KEY_DATA}_${biz.id}_2030`);
  assert.equal(importFullFinancialBackup(JSON.stringify(backup)).success, true);
  assert.deepEqual(JSON.parse(localStorage.getItem(`${STORAGE_KEY_DATA}_${biz.id}_2030`)!), months);
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_BIZ)!), []);
  await saveCloud();
});
