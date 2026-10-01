import { cloudStore as localStorage, loadCloud, saveCloud } from '../src/lib/cloudStore';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyMonths } from '../src/utils/calculations';
import { calculateBusinessYear, exportFullFinancialBackup, importFullFinancialBackup, normalizeMonthData, STORAGE_KEY_BUSINESSES, STORAGE_KEY_DATA, STORAGE_KEY_DELETED_BIZ } from '../src/utils/dataRecovery';

test('backup preserves future years, receipts and legacy row IDs; invalid input does not change records', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    get length() { return store.size; }, key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)), removeItem: (key: string) => store.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } });
  globalThis.fetch = async (_input, init) => Response.json(init?.body ? { revision: 1, values: JSON.parse(String(init.body)).values } : { revision: 0, values: {airbnb_accounting_version:'2'} });
  await loadCloud();
  const biz = { id: 'test-property', name: 'Test property', category: '', currency: 'PHP', description: '', createdAt: 1 };
  const months = createEmptyMonths(2030);
  months[6].ledger.push({ id: 'jul-stmt-real', date: '2030-07-01', type: 'Expense', description: 'Repair', category: 'Maintenance & Repairs', receiptNo: '', inflow: '', outflow: 123, notes: '', attachments: [{ id: 'receipt', url: 'data:image/png;base64,TEST', name: 'receipt.png' }] });
  localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify([biz]));
  localStorage.setItem(`${STORAGE_KEY_DATA}_${biz.id}_2030`, JSON.stringify(months));
  const backup = exportFullFinancialBackup();
  assert.equal(backup.data[biz.id].years[2030][6].ledger[0].id, 'jul-stmt-real');
  assert.deepEqual(backup.data[biz.id].years[2030][6].ledger[0].attachments, months[6].ledger[0].attachments);
  assert.equal(backup.data[biz.id].years[2030][6].ledger[0].outflow,123);
  assert.equal(normalizeMonthData(months, biz.id)[6].ledger.length, 1);
  const before = exportFullFinancialBackup().data;
  assert.equal(importFullFinancialBackup(JSON.stringify({ businesses: [biz], data: { [biz.id]: { partners: [], years: { 2030: [null] } } } })).success, false);
  assert.deepEqual(exportFullFinancialBackup().data, before);
  localStorage.setItem(STORAGE_KEY_DELETED_BIZ, JSON.stringify([biz.id]));
  localStorage.removeItem(`${STORAGE_KEY_DATA}_${biz.id}_2030`);
  assert.equal(importFullFinancialBackup(JSON.stringify(backup)).success, true);
  assert.deepEqual(JSON.parse(localStorage.getItem(`${STORAGE_KEY_DATA}_${biz.id}_2030`)!), JSON.parse(JSON.stringify(backup.data[biz.id].years[2030])));
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_BIZ)!), []);
  await saveCloud();
});

test('December cash and partner liability carry separately into the next year', () => {
  const partners=[{id:'a',name:'Alpha',sharePercentage:100}];
  const prior=createEmptyMonths(2031);
  prior[0].initialBalanceOverride=10000;
  prior[11].ledger=[{id:'repair',date:'2031-12-12',type:'Expense',description:'Repair',category:'Repairs',receiptNo:'',inflow:'',outflow:4000,notes:'',paidBy:'Alpha',partnerId:'a',fundingSource:'partner'}];
  localStorage.setItem('airbnb_tracker_partners_v2_cross-year',JSON.stringify(partners));
  localStorage.setItem(`${STORAGE_KEY_DATA}_cross-year_2031`,JSON.stringify(prior));
  const next=createEmptyMonths(2032);
  next[0].ledger=[{id:'repay',date:'2032-01-10',type:'Partner Reimbursement',description:'Partial repayment',category:'Reimbursement',receiptNo:'',inflow:'',outflow:1500,notes:'',paidBy:'Alpha',partnerId:'a'}];
  const result=calculateBusinessYear('cross-year',2032,next,partners);
  assert.equal(result.jan.beginningBalance,10000);
  assert.equal(result.jan.endingBalance,8500);
  assert.equal(result.jan.partnerBalances?.Alpha.pendingAmount,2500);
  assert.equal(result.jan.totalExpenses,0);
  assert.equal(result.feb.beginningBalance,8500);
});
