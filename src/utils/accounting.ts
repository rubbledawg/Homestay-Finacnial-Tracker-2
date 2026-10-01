import { BookingItem, MergedLedgerItem, Partner } from '../types';
import { parseAmount } from './formatters';

export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const businessNames = new Set(['business', 'property funds', 'property fund', 'business funds']);
export function isBusinessPayer(name?: string) { return !name?.trim() || businessNames.has(name.trim().toLowerCase()); }
export function resolvePartner(item: MergedLedgerItem, partners: Partner[] = []) {
  const partner = item.partnerId
    ? partners.find(p => p.id === item.partnerId)
    : partners.find(p => p.name.trim().toLowerCase() === item.paidBy?.trim().toLowerCase());
  return { id: partner?.id || item.partnerId, name: partner?.name || (!isBusinessPayer(item.paidBy) ? item.paidBy!.trim() : 'Unassigned partner') };
}
export function isFunding(item: MergedLedgerItem) {
  if (item.type === 'Partner Advance' || item.type === 'Capital Contribution') return true;
  if (item.type !== 'Income') return false;
  return /pre[ -]?fund|injected|capital injection/i.test(item.category + ' ' + item.description);
}
export function isPartnerExpense(item: MergedLedgerItem) {
  return item.type === 'Expense' && (item.fundingSource === 'partner' || item.isReimbursable === true || (!item.fundingSource && !isBusinessPayer(item.paidBy)));
}
export function reviewReason(item: MergedLedgerItem, partners: Partner[] = []): string | undefined {
  const payer = resolvePartner(item, partners);
  if (isPartnerExpense(item) || item.type === 'Partner Advance' || item.type === 'Partner Reimbursement') {
    if (!payer.id) return 'Confirm the partner who paid or received this amount.';
  }
  if (isFunding(item) && item.type === 'Income' && !item.fundingIntent) return 'Confirm whether historical funding is repayable or a capital contribution.';
  if (isPartnerExpense(item) && (item.legacyAccounting?.reimbursementStatus === 'Settled' || (!item.accountingVersion && item.reimbursementStatus === 'Settled')) && !item.legacySettlementReviewed) return 'Legacy settled flag: confirm reimbursement amount, payer and payment month. No cash payment has been inferred.';
  if (parseAmount(item.inflow) < 0 || parseAmount(item.outflow) < 0 || (parseAmount(item.inflow) && parseAmount(item.outflow))) return 'Confirm transaction amount and direction.';
  if (item.date && !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return 'Confirm transaction date.';
  return item.reviewReason;
}
export function transactionEffect(item: MergedLedgerItem, partners: Partner[] = []) {
  const inflow = money(parseAmount(item.inflow)), outflow = money(parseAmount(item.outflow));
  const payer = resolvePartner(item, partners);
  const partnerPaid = isPartnerExpense(item);
  const funding = isFunding(item);
  const advance = item.type === 'Partner Advance' || (funding && item.fundingIntent === 'repayable');
  const reimbursement = item.type === 'Partner Reimbursement';
  const capital = item.type === 'Capital Contribution' || (funding && item.fundingIntent === 'capital');
  const expense = item.type === 'Expense' ? outflow : 0;
  const income = item.type === 'Income' && !funding ? inflow : 0;
  const liabilityIncrease = (partnerPaid ? outflow : 0) + (advance ? inflow : 0);
  return { income, expense, cashIn: income + (funding ? inflow : 0), cashOut: reimbursement || (expense && !partnerPaid) ? outflow : 0,
    partnerPaid: partnerPaid ? outflow : 0, businessPaid: expense && !partnerPaid ? outflow : 0,
    advance: advance ? inflow : 0, reimbursement: reimbursement ? outflow : 0, capital: capital ? inflow : 0,
    liabilityChange: money(liabilityIncrease - (reimbursement ? outflow : 0)), payer, review: reviewReason(item, partners) };
}

// Net payout is the actual receipt. A promise to repay a discount is not cash.
// Pending/cancelled bookings never create cash or realized revenue.
export function bookingAmounts(b: BookingItem) {
  const nights = Math.max(1, parseAmount(b.nights));
  const discount = money(parseAmount(b.discount) * nights);
  const fees = money(parseAmount(b.platformFee));
  const gross = b.grossPayout !== undefined && b.grossPayout !== '' ? parseAmount(b.grossPayout)
    : b.rateMode === 'monthly' && parseAmount(b.monthlyRate) > 0 ? (nights >= 28 ? parseAmount(b.monthlyRate) : parseAmount(b.monthlyRate) * nights / 30)
    : parseAmount(b.nightlyRate) * nights;
  const expectedNet = money(Math.max(0, gross - discount - fees));
  const net = b.netPayout !== undefined && b.netPayout !== '' ? money(parseAmount(b.netPayout)) : expectedNet;
  const received = !/cancel|pending/i.test(b.status || '');
  return { gross: money(gross), fees, discount, net, cash: received ? net : 0, received, nights };
}

/** Additive, idempotent migration. Every original field is preserved, including ambiguous settlement flags. */
export function migrateLedger(items: MergedLedgerItem[], partners: Partner[]) {
  return items.map(item => {
    if (item.accountingVersion === 2) return item;
    const next = { ...item, accountingVersion: 2, legacyAccounting: item.legacyAccounting || {
      type: item.type, paidBy: item.paidBy ?? null, isReimbursable: item.isReimbursable ?? null,
      reimbursementStatus: item.reimbursementStatus ?? null, settlementDate: item.settlementDate ?? null,
    } };
    const partner = resolvePartner(item, partners);
    if (partner.id) next.partnerId = partner.id;
    if (isPartnerExpense(item)) next.fundingSource = 'partner';
    else if (item.type === 'Expense') next.fundingSource = 'business';
    // Calculate review before stamping the version: legacy settlements need explicit evidence.
    next.reviewReason = reviewReason(item, partners);
    return next;
  });
}

export function sortedTransactions<T extends { date: string; id: string }>(rows: T[]) {
  return [...rows].sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999') || a.id.localeCompare(b.id));
}
