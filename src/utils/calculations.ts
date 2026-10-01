import { MonthData, MonthCalculations, BookingItem, MergedLedgerItem, Partner } from '../types';
import { parseAmount, formatPHP } from './formatters';

export interface PartnerReimbursableDebt {
  partner: Partner;
  totalPaid: number;
  pendingPaid: number;
  settledPaid: number;
  fairShareTotal: number;
  fairSharePending: number;
  netPendingBalance: number; // positive: to receive, negative: owes
  netTotalBalance: number;
}

export interface ReimbursableDebtCalculationResult {
  totalAmount: number;
  totalPending: number;
  totalSettled: number;
  debts: Record<string, PartnerReimbursableDebt>;
  debtsList: PartnerReimbursableDebt[];
  settlementSummary: string;
}

export function getTotalPartnerShares(partners?: Partner[]): number {
  if (!partners || partners.length === 0) return 100;
  const sum = partners.reduce((s, p) => s + (p.sharePercentage || 0), 0);
  return sum > 0 ? sum : 100;
}

export function getPartnerShareRatio(partner: Partner, partners?: Partner[]): number {
  const total = getTotalPartnerShares(partners);
  return (partner.sharePercentage || 0) / total;
}

/**
 * Calculates how much each partner has paid out-of-pocket, their fair equity share,
 * and exactly how much other partners owe them based on their share percentages.
 */
export function calculatePartnerReimbursableDebts(
  items: MergedLedgerItem[],
  partners: Partner[]
): ReimbursableDebtCalculationResult {
  const reimbursableItems = items.filter((item) => {
    const isExp = item.type === 'Expense' || parseAmount(item.outflow) > 0;
    const isMarked = item.isReimbursable === true;
    const hasPartner = item.paidBy && item.paidBy !== 'Property Funds' && item.paidBy !== 'Property Fund';
    return isExp && (isMarked || Boolean(hasPartner));
  });

  let totalAmount = 0;
  let totalPending = 0;
  let totalSettled = 0;

  const paidByPartner: Record<string, { total: number; pending: number; settled: number }> = {};
  partners.forEach((p) => {
    paidByPartner[p.name] = { total: 0, pending: 0, settled: 0 };
  });

  reimbursableItems.forEach((item) => {
    const amt = parseAmount(item.outflow);
    totalAmount += amt;
    const isSettled = item.reimbursementStatus === 'Settled';
    if (isSettled) {
      totalSettled += amt;
    } else {
      totalPending += amt;
    }

    const pName = item.paidBy?.trim() || partners[0]?.name || 'Unassigned';
    if (!paidByPartner[pName]) {
      paidByPartner[pName] = { total: 0, pending: 0, settled: 0 };
    }
    paidByPartner[pName].total += amt;
    if (isSettled) {
      paidByPartner[pName].settled += amt;
    } else {
      paidByPartner[pName].pending += amt;
    }
  });

  const totalShares = partners.reduce((sum, p) => sum + (p.sharePercentage || 0), 0) || 100;

  const debtsList: PartnerReimbursableDebt[] = partners.map((p) => {
    const paid = paidByPartner[p.name] || { total: 0, pending: 0, settled: 0 };
    const shareRatio = (p.sharePercentage || 0) / totalShares;
    const fairShareTotal = totalAmount * shareRatio;
    const fairSharePending = totalPending * shareRatio;
    const netPendingBalance = paid.pending - fairSharePending;
    const netTotalBalance = paid.total - fairShareTotal;

    return {
      partner: p,
      totalPaid: paid.total,
      pendingPaid: paid.pending,
      settledPaid: paid.settled,
      fairShareTotal,
      fairSharePending,
      netPendingBalance,
      netTotalBalance,
    };
  });

  const debts: Record<string, PartnerReimbursableDebt> = {};
  debtsList.forEach((d) => {
    debts[d.partner.name] = d;
  });

  // Generate clear human-readable settlement summary
  let settlementSummary = '';
  if (totalPending === 0) {
    settlementSummary = 'All partner reimbursables are settled. Balances are fully squared.';
  } else if (partners.length === 2) {
    const p1 = debtsList[0];
    const p2 = debtsList[1];
    if (p1 && p2) {
      if (p1.netPendingBalance < -0.01) {
        settlementSummary = `${p1.partner.name} owes ${p2.partner.name} ${formatPHP(Math.abs(p1.netPendingBalance))} based on their ${p1.partner.sharePercentage}% equity share.`;
      } else if (p2.netPendingBalance < -0.01) {
        settlementSummary = `${p2.partner.name} owes ${p1.partner.name} ${formatPHP(Math.abs(p2.netPendingBalance))} based on their ${p2.partner.sharePercentage}% equity share.`;
      } else {
        settlementSummary = 'Reimbursables are currently balanced between partners.';
      }
    }
  } else {
    const creditors = debtsList.filter((d) => d.netPendingBalance > 0.01);
    const debtors = debtsList.filter((d) => d.netPendingBalance < -0.01);
    if (debtors.length > 0 && creditors.length > 0) {
      settlementSummary =
        debtors.map((d) => `${d.partner.name} owes ${formatPHP(Math.abs(d.netPendingBalance))}`).join(', ') +
        ' to ' +
        creditors.map((c) => `${c.partner.name} (receives ${formatPHP(c.netPendingBalance)})`).join(', ');
    } else {
      settlementSummary = 'Out-of-pocket expenses are currently balanced.';
    }
  }

  return {
    totalAmount,
    totalPending,
    totalSettled,
    debts,
    debtsList,
    settlementSummary,
  };
}

export interface ItemDebtSplit {
  partner: Partner;
  amountOwed: number;
}

/**
 * For a specific out-of-pocket reimbursable expense, returns:
 * - What the paying partner absorbs for their own equity share
 * - How much each other partner owes to the paying partner
 */
export function getItemPartnerDebtBreakdown(
  item: MergedLedgerItem,
  partners: Partner[]
): {
  payerPartner?: Partner;
  payerName: string;
  payerAbsorbed: number;
  payerSharePercentage: number;
  debts: ItemDebtSplit[];
} {
  const amount = parseAmount(item.outflow);
  const totalShares = partners.reduce((sum, p) => sum + (p.sharePercentage || 0), 0) || 100;
  const payerName = (item.paidBy || '').trim() || partners[0]?.name || 'Unassigned';
  const payerPartner = partners.find((p) => p.name.toLowerCase() === payerName.toLowerCase());

  const payerSharePercentage = payerPartner ? (payerPartner.sharePercentage || 0) : 0;
  const payerAbsorbed = (amount * payerSharePercentage) / totalShares;

  const debts: ItemDebtSplit[] = partners
    .filter((p) => p.name.toLowerCase() !== payerName.toLowerCase())
    .map((p) => ({
      partner: p,
      amountOwed: (amount * (p.sharePercentage || 0)) / totalShares,
    }));

  return {
    payerPartner,
    payerName,
    payerAbsorbed,
    payerSharePercentage,
    debts,
  };
}

/**
 * Checks if a ledger item is an owner pre-funding / injected funds entry
 */
export function isPreFundingItem(item: MergedLedgerItem): boolean {
  const cat = (item.category || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  return (
    cat.includes('pre-fund') ||
    cat.includes('prefund') ||
    cat.includes('injected') ||
    cat.includes('capital injection') ||
    desc.includes('pre-fund') ||
    desc.includes('prefund') ||
    desc.includes('injected funds') ||
    desc.includes('capital injection')
  );
}

/**
 * Determines if a discount was granted by a shareholder (partner).
 * Shareholder discounts do NOT reduce property net cash payout calculations
 * because the shareholder is responsible for repaying this amount to the property.
 */
export function isShareholderDiscount(
  discountBy?: string,
  partners?: Partner[]
): boolean {
  if (!discountBy || !discountBy.trim()) return false;
  const name = discountBy.trim().toLowerCase();
  if (
    name === 'airbnb' ||
    name === 'booking' ||
    name === 'booking.com' ||
    name === 'ota' ||
    name === 'platform' ||
    name === 'promo' ||
    name === 'promotion' ||
    name === 'direct'
  ) {
    return false;
  }
  if (partners && partners.length > 0) {
    return partners.some((p) => p.name.trim().toLowerCase() === name);
  }
  return name === 'locsin' || name === 'laspinas';
}

/**
 * Calculates a single month's totals given its beginning balance
 */
export function calculateSingleMonth(
  month: MonthData,
  beginningBalance: number,
  partners?: Partner[]
): MonthCalculations {
  let totalBookingsGross = 0;
  let totalBookingsFees = 0;
  let totalBookingsDiscounts = 0;
  let totalShareholderDiscounts = 0;
  let totalPlatformDiscounts = 0;
  const shareholderDiscountBreakdown: Record<string, number> = {};
  let totalBookingsNet = 0;
  let totalNights = 0;

  // 1. Separate Bookings calculations
  const bookingsList = month.bookings || [];
  for (const b of bookingsList) {
    const discountPerNight = parseAmount(b.discount);
    const nights = typeof b.nights === 'number' && b.nights > 0 ? b.nights : parseAmount(b.nights) || 1;
    const totalDiscount = discountPerNight * nights;
    const fee = parseAmount(b.platformFee);
    const isShareholderDisc = isShareholderDiscount(b.discountBy, partners);
    const rate = b.nightlyRate !== '' && b.nightlyRate !== undefined ? parseAmount(b.nightlyRate) : 0;
    const mRate = b.monthlyRate !== '' && b.monthlyRate !== undefined ? parseAmount(b.monthlyRate) : 0;

    if (totalDiscount > 0) {
      totalBookingsDiscounts += totalDiscount;
      if (isShareholderDisc) {
        totalShareholderDiscounts += totalDiscount;
        const partnerName = b.discountBy?.trim() || 'Shareholder';
        shareholderDiscountBreakdown[partnerName] = (shareholderDiscountBreakdown[partnerName] || 0) + totalDiscount;
      } else {
        totalPlatformDiscounts += totalDiscount;
      }
    }

    let net = 0;
    if (isShareholderDisc) {
      // Discounts made by shareholders do NOT affect net payout calculations since they will repay this back.
      if (b.rateMode === 'monthly' && mRate > 0) {
        net = Math.max(0, (nights >= 28 ? mRate : (mRate / 30) * nights) - fee);
      } else if (rate > 0 && nights > 0) {
        net = Math.max(0, (rate * nights) - fee);
      } else if (b.grossPayout !== '' && b.grossPayout !== undefined) {
        net = Math.max(0, parseAmount(b.grossPayout) - fee);
      } else if (b.netPayout !== '' && b.netPayout !== undefined) {
        net = parseAmount(b.netPayout);
      }
    } else {
      // Platform / OTA / General discounts DO reduce net payout
      if (b.netPayout !== '' && b.netPayout !== undefined) {
        net = parseAmount(b.netPayout);
      } else if (b.rateMode === 'monthly' && mRate > 0) {
        const base = nights >= 28 ? mRate : (mRate / 30) * nights;
        net = Math.max(0, base - totalDiscount - fee);
      } else if (rate > 0 && nights > 0) {
        net = Math.max(0, (rate - discountPerNight) * nights - fee);
      } else if (b.grossPayout !== '' && b.grossPayout !== undefined) {
        net = Math.max(0, parseAmount(b.grossPayout) - fee - totalDiscount);
      }
    }

    const gross =
      b.grossPayout !== '' && b.grossPayout !== undefined
        ? parseAmount(b.grossPayout)
        : rate > 0
        ? rate * nights
        : net + (isShareholderDisc ? 0 : totalDiscount) + fee;

    if (typeof b.nights === 'number') {
      totalNights += b.nights;
    }

    totalBookingsGross += gross;
    totalBookingsFees += fee;
    totalBookingsNet += net;
  }

  // 2. Merged Income and Expense Ledger calculations
  let totalOtherIncome = 0;
  let totalExpenses = 0;
  let totalPreFunding = 0;
  let totalReimbursables = 0;
  let totalPendingReimbursements = 0;
  let totalSettledReimbursements = 0;
  const partnerBalances: Record<string, { partnerName: string; totalPaid: number; pendingAmount: number; settledAmount: number }> = {};

  const ledgerList = month.ledger || [];
  for (const item of ledgerList) {
    const inflow = parseAmount(item.inflow);
    const outflow = parseAmount(item.outflow);

    const isPreFund = isPreFundingItem(item);

    if (isPreFund) {
      totalPreFunding += inflow;
    } else if (item.type === 'Income' || inflow > 0) {
      totalOtherIncome += inflow;
    }

    if (item.type === 'Expense' || outflow > 0) {
      totalExpenses += outflow;

      // Track partner reimbursables
      if (item.isReimbursable) {
        totalReimbursables += outflow;
        const isSettled = item.reimbursementStatus === 'Settled';
        if (isSettled) {
          totalSettledReimbursements += outflow;
        } else {
          totalPendingReimbursements += outflow;
        }

        const pName = (item.paidBy && item.paidBy.trim()) || 'Unassigned Partner';
        if (!partnerBalances[pName]) {
          partnerBalances[pName] = {
            partnerName: pName,
            totalPaid: 0,
            pendingAmount: 0,
            settledAmount: 0,
          };
        }
        partnerBalances[pName].totalPaid += outflow;
        if (isSettled) {
          partnerBalances[pName].settledAmount += outflow;
        } else {
          partnerBalances[pName].pendingAmount += outflow;
        }
      }
    }
  }

  const totalOperatingRevenue = totalBookingsNet + totalOtherIncome;
  // Pre-funds are included in the calculations of inflow and net profit/loss
  const totalNetIncome = totalOperatingRevenue + totalPreFunding;
  const openingInflow = beginningBalance >= 0 ? beginningBalance : 0;
  const openingOutflow = beginningBalance < 0 ? Math.abs(beginningBalance) : 0;
  const totalCalculatedInflow = openingInflow + totalNetIncome;
  const totalCalculatedOutflow = openingOutflow + totalExpenses;

  // Monthly Operating Net Profit / Loss (Current month's inflow minus current month's expenses)
  const monthlyNetProfit = totalNetIncome - totalExpenses;

  // Total Ending Cash Balance (Beginning Balance + Monthly Net P&L = Inflows - Outflows)
  const endingBalance = beginningBalance + monthlyNetProfit;

  // netProfit also represents the monthly performance
  const netProfit = monthlyNetProfit;

  const totalOpeningCash = beginningBalance + totalPreFunding;
  const profitMargin = totalNetIncome > 0 ? (monthlyNetProfit / totalNetIncome) * 100 : 0;

  return {
    beginningBalance,
    totalPreFunding,
    totalOpeningCash,
    totalBookingsGross,
    totalBookingsFees,
    totalBookingsDiscounts,
    totalDiscounts: totalBookingsDiscounts,
    totalShareholderDiscounts,
    totalPlatformDiscounts,
    shareholderDiscountBreakdown,
    totalBookingsNet,
    totalOtherIncome,
    totalOperatingRevenue,
    totalNetIncome,
    totalExpenses,
    totalCalculatedInflow,
    totalCalculatedOutflow,
    monthlyNetProfit,
    netProfit,
    endingBalance,
    profitMargin,
    totalNights,
    totalReimbursables,
    totalPendingReimbursements,
    totalSettledReimbursements,
    partnerBalances,
  };
}

/**
 * Calculates all months in sequence with carryover from month to month
 */
export function calculateAllMonths(
  months: MonthData[],
  startingCapital = 0,
  partners?: Partner[]
): Record<string, MonthCalculations> {
  const calculations: Record<string, MonthCalculations> = {};
  let currentCarryover = startingCapital;

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    // If the first month has a custom override, respect it
    if (i === 0 && month.initialBalanceOverride !== undefined) {
      currentCarryover = month.initialBalanceOverride;
    }

    const result = calculateSingleMonth(month, currentCarryover, partners);
    calculations[month.id] = result;
    
    // Carry over this month's ending balance to the next month
    currentCarryover = result.endingBalance;
  }

  return calculations;
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

