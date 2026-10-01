import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAllMonths,calculateSingleMonth,createEmptyMonths } from '../src/utils/calculations';
import { migrateLedger,bookingAmounts,transactionEffect } from '../src/utils/accounting';
import { rowsWithCashBalance } from '../src/utils/ledgerRows';
import { buildSelectedMonthsCSV } from '../src/utils/export';
import { MergedLedgerItem,Partner } from '../src/types';
const partners:Partner[]=[{id:'a',name:'Alpha',sharePercentage:42},{id:'b',name:'Beta',sharePercentage:58}];
const entry=(overrides:Partial<MergedLedgerItem>):MergedLedgerItem=>({id:'expense',date:'2026-07-02',type:'Expense',description:'Repair',category:'Repairs',receiptNo:'R1',inflow:'',outflow:2000,notes:'',...overrides});
const month=(ledger:MergedLedgerItem[])=>({...createEmptyMonths(2026)[6],ledger});
test('1 business expense reduces cash and profit without creating partner debt',()=>{
 const c=calculateSingleMonth(month([entry({})]),10000,partners);
 assert.equal(c.endingBalance,8000);assert.equal(c.totalExpenses,2000);assert.equal(c.totalDueToPartners,0);assert.equal(c.netProfit,-2000);
});
test('2 partner expense leaves cash unchanged, records all expense and owes the entire payer amount',()=>{
 const c=calculateSingleMonth(month([entry({outflow:4000,paidBy:'Alpha',isReimbursable:true})]),10000,partners);
 assert.equal(c.endingBalance,10000);assert.equal(c.totalExpenses,4000);assert.equal(c.partnerBalances?.Alpha.pendingAmount,4000);assert.equal(c.totalDueToPartners,4000);
});
test('3 partial reimbursement reduces cash and debt without another expense',()=>{
 const c=calculateSingleMonth(month([entry({outflow:4000,paidBy:'Alpha',fundingSource:'partner'}),entry({id:'repay',type:'Partner Reimbursement',paidBy:'Alpha',outflow:1500})]),10000,partners);
 assert.equal(c.endingBalance,8500);assert.equal(c.totalExpenses,4000);assert.equal(c.partnerBalances?.Alpha.pendingAmount,2500);assert.equal(c.partnerReimbursements,1500);
});
test('4 repayable cash advance increases cash and debt but never revenue or profit',()=>{
 const c=calculateSingleMonth(month([entry({type:'Partner Advance',inflow:10000,outflow:'',paidBy:'Beta'})]),2000,partners);
 assert.equal(c.endingBalance,12000);assert.equal(c.totalDueToPartners,10000);assert.equal(c.partnerAdvances,10000);assert.equal(c.totalNetIncome,0);assert.equal(c.netProfit,0);
});
test('5 carry cash and each partner liability separately across months regardless of input order',()=>{
 const months=createEmptyMonths(2026);months[0].initialBalanceOverride=10000;months[6].ledger=[entry({outflow:4000,paidBy:'Alpha',isReimbursable:true})];months[7].ledger=[entry({type:'Partner Reimbursement',paidBy:'Alpha',outflow:1500})];
 const c=calculateAllMonths([...months].reverse(),0,partners);
 assert.equal(c.jul.endingBalance,10000);assert.equal(c.aug.beginningBalance,10000);assert.equal(c.aug.endingBalance,8500);assert.equal(c.aug.partnerBalances?.Alpha.pendingAmount,2500);assert.equal(c.sep.totalDueToPartners,2500);
});
test('legacy migration preserves evidence, flags missing payers and settled flags, and is idempotent',()=>{
 const original=[entry({paidBy:'Alpha',isReimbursable:true,receiptImage:'data:image/png;base64,abc'}),entry({id:'unknown',paidBy:undefined,isReimbursable:true}),entry({id:'settled',paidBy:'Beta',isReimbursable:true,reimbursementStatus:'Settled',settlementDate:'2026-08-01'})];
 const migrated=migrateLedger(original,partners);assert.equal(migrated[0].partnerId,'a');assert.equal(migrated[0].receiptImage,original[0].receiptImage);assert.equal(original[0].accountingVersion,undefined);assert.ok(migrated[1].reviewReason);assert.match(migrated[2].reviewReason || '',/Legacy settled/);assert.deepEqual(migrateLedger(migrated,partners),migrated);
 const c=calculateSingleMonth(month(migrated),5000,partners);assert.equal(c.endingBalance,5000);assert.equal(c.totalDueToPartners,6000);assert.equal(c.partnerReimbursements,0);
});
test('historical funding does not become profit or an invented partner allocation',()=>{
 const item=entry({type:'Income',category:'Pre-Funding / Injected Funds',paidBy:'All Owners',inflow:10000,outflow:''});
 const c=calculateSingleMonth(month([item]),0,partners);assert.equal(c.endingBalance,10000);assert.equal(c.totalNetIncome,0);assert.equal(c.totalDueToPartners,0);assert.match(c.reviewItems[0].reason,/repayable/);
});
test('cash ledger, export and dashboard agree for income, personal expense, advance and repayment',()=>{
 const m=month([entry({id:'income',type:'Income',inflow:3000,outflow:''}),entry({outflow:4000,paidBy:'Alpha',isReimbursable:true}),entry({id:'advance',type:'Partner Advance',paidBy:'Beta',inflow:10000,outflow:''}),entry({id:'repay',type:'Partner Reimbursement',paidBy:'Alpha',outflow:1500})]);
 const c=calculateSingleMonth(m,2000,partners);assert.equal(c.endingBalance,13500);assert.equal(c.netProfit,-1000);
 assert.equal(rowsWithCashBalance(m,2000,partners).at(-1)?.runningBalance,c.endingBalance);
 const csv=buildSelectedMonthsCSV([m],{jul:c},['jul'],2026,partners);assert.match(csv,/13500.00/);assert.match(csv,/Partner liability change/);assert.match(csv,/Alpha/);
});
test('partner rename retains debt identity and capital funding creates no reimbursement claim',()=>{
 const c=calculateSingleMonth(month([entry({paidBy:'Old name',partnerId:'a',fundingSource:'partner'}),entry({type:'Capital Contribution',inflow:5000,outflow:'',partnerId:'b'})]),0,partners);
 assert.equal(c.partnerBalances?.Alpha.pendingAmount,2000);assert.equal(c.endingBalance,5000);assert.equal(c.totalDueToPartners,2000);assert.equal(c.netProfit,-2000);
});
test('cancelled and pending bookings are excluded; discounted payout and platform fee are never inflated',()=>{
 const b={id:'booking',date:'2026-07-01',unit:'1',guestName:'Guest',nights:2,nightlyRate:2000,platformFee:300,discount:500,discountBy:'Alpha',netPayout:'',status:'Completed',notes:''} as const;
 assert.equal(bookingAmounts(b).cash,2700);assert.equal(bookingAmounts({...b,status:'Cancelled'}).cash,0);assert.equal(bookingAmounts({...b,status:'Pending Payout'}).cash,0);assert.equal(bookingAmounts({...b,netPayout:2500}).cash,2500);
});
test('business cash shortfall is flagged without inventing a partner or clamping the balance',()=>{
 const c=calculateSingleMonth(month([entry({outflow:12000,paidBy:'Business'})]),5000,partners);assert.equal(c.endingBalance,-7000);assert.equal(c.totalDueToPartners,0);assert.ok(c.reviewItems.some(r=>r.id==='jul'));
});
