import { MonthData, MonthCalculations, MergedLedgerItem, Partner, PartnerReimbursementBalance } from '../types';
import { formatPHP } from './formatters';
import { bookingAmounts, transactionEffect, isPartnerExpense, isFunding, resolvePartner, money } from './accounting';

export function getTotalPartnerShares(partners?: Partner[]) { return partners?.reduce((s,p) => s + p.sharePercentage,0) || 100; }
export function getPartnerShareRatio(partner: Partner, partners?: Partner[]) { return partner.sharePercentage / getTotalPartnerShares(partners); }
export const isPreFundingItem = isFunding;
export function isShareholderDiscount(discountBy?: string, partners: Partner[] = []) {
  return partners.some(p => p.name.trim().toLowerCase() === discountBy?.trim().toLowerCase());
}
export function calculateSingleMonth(month: MonthData, beginningBalance: number, partners: Partner[] = [], openingBalances: Record<string, PartnerReimbursementBalance> = {}): MonthCalculations {
  const balances: Record<string, PartnerReimbursementBalance> = structuredClone(openingBalances);
  let revenue=0, expense=0, businessPaid=0, partnerPaid=0, advances=0, reimbursements=0, capital=0, funding=0, cashIn=0, cashOut=0;
  let gross=0, fees=0, discounts=0, partnerDiscounts=0, bookingNet=0, nights=0;
  const shareholderDiscountBreakdown: Record<string,number> = {};
  const reviewItems: {id:string;reason:string;label?:string}[] = [];
  for (const b of month.bookings || []) {
    const amount = bookingAmounts(b);
    if (amount.received) { gross+=amount.gross; fees+=amount.fees; discounts+=amount.discount; bookingNet+=amount.cash; nights+=amount.nights; }
    if (amount.received && isShareholderDiscount(b.discountBy,partners)) {
      partnerDiscounts+=amount.discount;
      shareholderDiscountBreakdown[b.discountBy!] = (shareholderDiscountBreakdown[b.discountBy!] || 0) + amount.discount;
      if (amount.discount > 0) reviewItems.push({id:b.id,label:b.guestName || 'Booking payout',reason:'Partner discount: confirm that recorded net payout is money actually received. Record any later repayment separately.'});
    }
  }
  revenue=bookingNet; cashIn=bookingNet;
  for (const item of month.ledger || []) {
    const e=transactionEffect(item,partners);
    revenue+=e.income; expense+=e.expense; businessPaid+=e.businessPaid; partnerPaid+=e.partnerPaid;
    advances+=e.advance; reimbursements+=e.reimbursement; capital+=e.capital;
    if (isFunding(item)) funding+=e.cashIn;
    cashIn+=e.cashIn; cashOut+=e.cashOut;
    if (e.review) reviewItems.push({id:item.id,label:item.description || item.type,reason:e.review});
    if (e.liabilityChange || e.partnerPaid || e.advance || e.reimbursement) {
      const name=e.payer.name;
      const balance=balances[name] ||= {partnerName:name,totalPaid:0,pendingAmount:0,settledAmount:0,expensesFunded:0,cashAdvanced:0,reimbursements:0};
      balance.totalPaid=money(balance.totalPaid+e.partnerPaid+e.advance);
      balance.expensesFunded=money((balance.expensesFunded || 0)+e.partnerPaid);
      balance.cashAdvanced=money((balance.cashAdvanced || 0)+e.advance);
      balance.settledAmount=money(balance.settledAmount+e.reimbursement);
      balance.reimbursements=money((balance.reimbursements || 0)+e.reimbursement);
      balance.pendingAmount=money(balance.pendingAmount+e.liabilityChange);
      if (balance.pendingAmount < -0.005) reviewItems.push({id:item.id,reason:'Reimbursements exceed recorded partner funding. Confirm opening partner balance or payment classification.'});
    }
  }
  const netProfit=money(revenue-expense);
  const totalDueToPartners=money(Object.values(balances).reduce((s,b)=>s+Math.max(0,b.pendingAmount),0));
  const endingBalance=money(beginningBalance+cashIn-cashOut);
  if (endingBalance < 0) reviewItems.push({id:month.id,label:month.name+' cash balance',reason:'Recorded business payments exceed available cash. Confirm the payer or missing cash receipts; no partner assignment has been guessed.'});
  return {beginningBalance:money(beginningBalance),totalPreFunding:money(funding),totalOpeningCash:money(beginningBalance+funding),
    totalBookingsGross:money(gross),totalBookingsFees:money(fees),totalBookingsDiscounts:money(discounts),totalDiscounts:money(discounts),
    totalShareholderDiscounts:money(partnerDiscounts),totalPlatformDiscounts:money(discounts-partnerDiscounts),shareholderDiscountBreakdown,
    totalBookingsNet:money(bookingNet),totalOtherIncome:money(revenue-bookingNet),totalOperatingRevenue:money(revenue),totalNetIncome:money(revenue),
    totalExpenses:money(expense),totalCalculatedInflow:money(Math.max(0,beginningBalance)+cashIn),totalCalculatedOutflow:money(Math.max(0,-beginningBalance)+cashOut),
    monthlyNetProfit:netProfit,netProfit,endingBalance,profitMargin:revenue ? netProfit/revenue*100 : 0,totalNights:nights,
    totalReimbursables:money(partnerPaid),totalPendingReimbursements:totalDueToPartners,totalSettledReimbursements:money(reimbursements),partnerBalances:balances,
    businessPaidExpenses:money(businessPaid),partnerPaidExpenses:money(partnerPaid),partnerAdvances:money(advances),partnerReimbursements:money(reimbursements),capitalContributions:money(capital),
    cashInflow:money(cashIn),cashOutflow:money(cashOut),totalDueToPartners,reviewItems};
}
export function calculateAllMonths(months: MonthData[], startingCapital=0, partners: Partner[] = [], openingBalances: Record<string, PartnerReimbursementBalance> = {}) {
  const calculations: Record<string,MonthCalculations> = {};
  let cash=startingCapital, balances=structuredClone(openingBalances);
  const ordered=[...months].sort((a,b)=>a.year-b.year || MONTH_NAMES.findIndex(m=>m.id===a.id)-MONTH_NAMES.findIndex(m=>m.id===b.id));
  ordered.forEach((month,i)=>{
    if(i===0 && month.initialBalanceOverride!==undefined) cash=month.initialBalanceOverride;
    if(i===0 && month.openingPartnerBalances) for(const [name,amount] of Object.entries(month.openingPartnerBalances)) {
      balances[name]={partnerName:name,totalPaid:amount,pendingAmount:amount,settledAmount:0,expensesFunded:0,cashAdvanced:0,reimbursements:0};
    }
    const result=calculateSingleMonth(month,cash,partners,balances); calculations[month.id]=result;
    cash=result.endingBalance; balances=result.partnerBalances!;
  });
  return calculations;
}
// Compatibility helpers use business liabilities; ownership percentages never reduce reimbursement rights.
export function calculatePartnerReimbursableDebts(items: MergedLedgerItem[],partners: Partner[]) {
  const calc=calculateSingleMonth({id:'jan',name:'January',shortName:'Jan',year:2026,bookings:[],ledger:items},0,partners);
  const debtsList=partners.map(partner=>{
    const b=calc.partnerBalances?.[partner.name];
    return {partner,totalPaid:b?.totalPaid || 0,pendingPaid:b?.pendingAmount || 0,settledPaid:b?.settledAmount || 0,fairShareTotal:0,fairSharePending:0,netPendingBalance:b?.pendingAmount || 0,netTotalBalance:b?.totalPaid || 0};
  });
  return {totalAmount:calc.totalReimbursables,totalPending:calc.totalDueToPartners,totalSettled:calc.partnerReimbursements,debts:Object.fromEntries(debtsList.map(d=>[d.partner.name,d])),debtsList,settlementSummary:'Amounts owed by the business to the partners who funded it.'};
}
export function getItemPartnerDebtBreakdown(item: MergedLedgerItem,partners: Partner[]) {
  const payer=resolvePartner(item,partners);
  return {payerPartner:partners.find(p=>p.id===payer.id),payerName:payer.name,payerAbsorbed:0,payerSharePercentage:0,debts:[] as {partner:Partner;amountOwed:number}[]};
}

export const MONTH_NAMES = [
  { id: 'jan', name: 'January', shortName: 'Jan' },
  { id: 'feb', name: 'February', shortName: 'Feb' },
  { id: 'mar', name: 'March', shortName: 'Mar' },
  { id: 'apr', name: 'April', shortName: 'Apr' },
  { id: 'may', name: 'May', shortName: 'May' },
  { id: 'jun', name: 'June', shortName: 'Jun' },
  { id: 'jul', name: 'July', shortName: 'Jul' },
  { id: 'aug', name: 'August', shortName: 'Aug' },
  { id: 'sep', name: 'September', shortName: 'Sep' },
  { id: 'oct', name: 'October', shortName: 'Oct' },
  { id: 'nov', name: 'November', shortName: 'Nov' },
  { id: 'dec', name: 'December', shortName: 'Dec' },
];

/**
 * Creates empty month data structure with clean empty ledgers
 */
export function createEmptyMonths(year: number = new Date().getFullYear()): MonthData[] {
  return MONTH_NAMES.map((m) => {
    const month: MonthData = {
      id: m.id,
      name: m.name,
      shortName: m.shortName,
      year,
      bookings: [],
      ledger: [],
    };
    if (m.id === 'jan') {
      month.initialBalanceOverride = 0;
    }
    return month;
  });
}

