import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { MonthData, MonthCalculations, Partner, MergedLedgerItem } from '../types';
import { formatPHP, parseAmount } from './formatters';
import { isPreFundingItem, isShareholderDiscount } from './calculations';

export interface UnifiedExportLedgerRow {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  description: string;
  category: string;
  receiptNo: string;
  inflow: number;
  outflow: number;
  netAmount: number;
  paidBy: string;
  isReimbursable?: boolean;
  notes: string;
  // Booking discount details
  discountAmount?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number | '';
  discountBy?: string;
  discountMeta?: string;
  isShareholderDiscount?: boolean;
  nightlyRate?: number;
  nights?: number;
}

/**
 * Transforms bookings and ledger items into a unified, chronological list of income & expenses.
 */
export function getUnifiedLedgerRows(month: MonthData, partners?: Partner[]): UnifiedExportLedgerRow[] {
  const rows: UnifiedExportLedgerRow[] = [];

  // 1. Add Bookings as Inflow rows
  (month.bookings || []).forEach((b) => {
    const discountPerNight = parseAmount(b.discount);
    const fee = parseAmount(b.platformFee);
    const nights = typeof b.nights === 'number' ? b.nights : parseAmount(b.nights);
    const validNights = nights > 0 ? nights : 1;
    const totalDiscount = discountPerNight * validNights;
    const rate = b.nightlyRate !== '' && b.nightlyRate !== undefined ? parseAmount(b.nightlyRate) : 0;
    const mRate = b.monthlyRate !== '' && b.monthlyRate !== undefined ? parseAmount(b.monthlyRate) : 0;
    const isShareholderDisc = isShareholderDiscount(b.discountBy, partners);

    let net = 0;
    if (isShareholderDisc) {
      // Discounts made by shareholders do NOT affect net payout calculations since they will repay this back.
      if (b.rateMode === 'monthly' && mRate > 0) {
        net = Math.max(0, (validNights >= 28 ? mRate : (mRate / 30) * validNights) - fee);
      } else if (rate > 0 && validNights > 0) {
        net = Math.max(0, (rate * validNights) - fee);
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
        const base = validNights >= 28 ? mRate : (mRate / 30) * validNights;
        net = Math.max(0, base - totalDiscount - fee);
      } else if (rate > 0 && validNights > 0) {
        net = Math.max(0, (rate - discountPerNight) * validNights - fee);
      } else if (b.grossPayout !== '' && b.grossPayout !== undefined) {
        net = Math.max(0, parseAmount(b.grossPayout) - fee - totalDiscount);
      }
    }

    const guest = b.guestName ? b.guestName : 'Guest Booking';
    const detailParts: string[] = [];
    if (b.rateMode === 'monthly' && b.monthlyRate !== '' && b.monthlyRate !== undefined) {
      const m = parseAmount(b.monthlyRate);
      detailParts.push(`${validNights} ${validNights === 1 ? 'nt' : 'nts'} @ ₱${m.toLocaleString()}/mo`);
    } else if (validNights > 0 && rate > 0) {
      detailParts.push(`${validNights} ${validNights === 1 ? 'nt' : 'nts'} @ ₱${rate.toLocaleString()}/nt`);
    } else if (validNights > 0) {
      detailParts.push(`${validNights} ${validNights === 1 ? 'nt' : 'nts'}`);
    }

    // Extract discount meta for dedicated DISCOUNTS column
    const metaParts: string[] = [];
    if (totalDiscount > 0 || (typeof b.discount === 'number' && b.discount > 0)) {
      if (b.discountType === 'percent' && b.discountValue !== undefined && b.discountValue !== '') {
        metaParts.push(`${b.discountValue}%`);
      } else if (discountPerNight > 0 && rate > 0) {
        const calcPct = Math.round((discountPerNight / rate) * 100);
        if (calcPct > 0) metaParts.push(`${calcPct}%`);
      }
      if (b.discountBy) {
        metaParts.push(`by ${b.discountBy}`);
      }
    } else if (b.discountBy) {
      metaParts.push(`by ${b.discountBy}`);
    }
    const discountMeta = metaParts.length > 0 ? metaParts.join(' ') : undefined;

    if (b.notes && typeof b.notes === 'string' && b.notes.trim() !== '' && b.notes.trim() !== '0') {
      detailParts.push(b.notes.trim());
    }

    const dateDisplay = b.date
      ? b.checkOutDate && b.checkOutDate !== b.date
        ? `${b.date} → ${b.checkOutDate}`
        : b.date
      : '';

    rows.push({
      id: `booking-${b.id}`,
      date: dateDisplay,
      type: 'Income',
      description: guest,
      category: 'Booking Payout',
      receiptNo: b.bookingRef || '',
      inflow: net,
      outflow: 0,
      netAmount: net,
      paidBy: b.unit || b.channel || 'Airbnb / Direct',
      notes: detailParts.join(' • '),
      discountAmount: totalDiscount,
      discountType: b.discountType,
      discountValue: b.discountValue,
      discountBy: b.discountBy,
      discountMeta,
      isShareholderDiscount: isShareholderDisc,
      nightlyRate: rate,
      nights: validNights,
    });
  });

  // 2. Add Ledger items (Manual Income & Expenses, including Pre-Funding & Reimbursables)
  const ledgerList = month.ledger || [];
  const preFundingItems: MergedLedgerItem[] = [];
  const regularItems: MergedLedgerItem[] = [];

  ledgerList.forEach((item) => {
    if (isPreFundingItem(item)) {
      preFundingItems.push(item);
    } else {
      regularItems.push(item);
    }
  });

  // Regular non-prefunding income and expenses
  regularItems.forEach((item) => {
    const inflow = parseAmount(item.inflow);
    const outflow = parseAmount(item.outflow);
    const type = item.type || (inflow > 0 ? 'Income' : 'Expense');
    const netAmount = inflow - outflow;

    rows.push({
      id: item.id,
      date: item.date || '',
      type,
      description: item.description || (type === 'Income' ? 'Income Entry' : 'Expense Entry'),
      category: item.category || (type === 'Income' ? 'Other Inflow' : 'Maintenance & Repairs'),
      receiptNo: item.receiptNo || '',
      inflow,
      outflow,
      netAmount,
      paidBy: item.paidBy || 'Property Funds',
      isReimbursable: item.isReimbursable,
      notes: item.notes || '',
    });
  });

  // Consolidate Pre-Funding into Total of Shareholders (combining individual partner split lines)
  if (preFundingItems.length > 0) {
    const dates = preFundingItems.map((p) => p.date).filter(Boolean);
    const dominantDate = dates.length > 0 ? dates[0] : '';

    const dateGroups: Record<string, MergedLedgerItem[]> = {};
    preFundingItems.forEach((item) => {
      const d = item.date || dominantDate || '';
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(item);
    });

    Object.entries(dateGroups).forEach(([dateKey, itemsInGroup]) => {
      const totalInflow = itemsInGroup.reduce((sum, it) => sum + parseAmount(it.inflow), 0);
      const totalOutflow = itemsInGroup.reduce((sum, it) => sum + parseAmount(it.outflow), 0);
      if (totalInflow === 0 && totalOutflow === 0) return;

      const receipts = itemsInGroup
        .map((it) => it.receiptNo)
        .filter((r): r is string => Boolean(r && r.trim()))
        .join(', ');

      const shareholderContributions = itemsInGroup
        .map((it) => {
          const name = (it.paidBy || '').replace(/All Owners.*|All Shareholders.*/gi, '').trim();
          const amt = parseAmount(it.inflow);
          if (name && amt > 0) {
            return `${name}: ${formatPHP(amt)}`;
          }
          return '';
        })
        .filter(Boolean);

      let noteText = '';
      if (shareholderContributions.length > 0) {
        noteText = shareholderContributions.join(', ');
      } else if (itemsInGroup[0]?.notes && !itemsInGroup[0].notes.toLowerCase().includes('split across')) {
        noteText = itemsInGroup[0].notes;
      }

      rows.push({
        id: `prefunding-total-${dateKey || 'nodate'}-${month.id}`,
        date: dateKey,
        type: 'Income',
        description: 'Owner Working Capital Pre-Funding',
        category: 'Pre-Funding / Injected Funds',
        receiptNo: receipts,
        inflow: totalInflow,
        outflow: totalOutflow,
        netAmount: totalInflow - totalOutflow,
        paidBy: 'All Shareholders',
        notes: noteText,
      });
    });
  }

  // Sort chronologically by date
  return rows.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

/**
 * Exports chosen months to CSV, containing the compact summary and running balance ledger
 * organized by month.
 */
export function exportSelectedMonthsToCSV(
  months: MonthData[],
  calculations: Record<string, MonthCalculations>,
  selectedMonthIds: string[],
  year: number,
  partners?: Partner[]
): void {
  const selectedMonths = months.filter((m) => selectedMonthIds.includes(m.id));
  if (selectedMonths.length === 0) return;

  const lines: string[] = [];
  const selectedMonthNames = selectedMonths.map((m) => m.shortName).join(', ');
  const periodTitle =
    selectedMonths.length === 12
      ? `FULL YEAR ${year}`
      : selectedMonths.length === 1
      ? `${selectedMonths[0].name.toUpperCase()} ${year}`
      : `${selectedMonthNames.toUpperCase()} ${year}`;

  // File Metadata
  lines.push(`"AIRBNB FINANCIAL & OPERATIONS REPORT"`);
  lines.push(`"Reporting Period: ${periodTitle} | Cash Flow, Operating Disbursements & Partner Reimbursements"`);
  lines.push(`"Currency: Philippine Peso (PHP - ₱)"`);
  lines.push(`"Generated on: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'medium' })}"`);
  lines.push('');

  // Compact Period Executive Summary (if multi-month or single)
  let totalGrossInflow = 0;
  let totalExpenses = 0;
  let totalNetProfit = 0;
  let totalShareholderDiscounts = 0;
  let totalPlatformDiscounts = 0;
  let grandTotalDiscounts = 0;

  selectedMonths.forEach((m) => {
    const calc = calculations[m.id];
    totalGrossInflow += calc?.totalNetIncome || 0;
    totalExpenses += calc?.totalExpenses || 0;
    totalNetProfit += calc?.netProfit || 0;
    totalShareholderDiscounts += calc?.totalShareholderDiscounts || 0;
    totalPlatformDiscounts += calc?.totalPlatformDiscounts || 0;
    grandTotalDiscounts += calc?.totalDiscounts || 0;
  });

  const firstCalc = calculations[selectedMonths[0].id];
  const lastCalc = calculations[selectedMonths[selectedMonths.length - 1].id];
  const startingCash = firstCalc ? firstCalc.beginningBalance : 0;
  const endingCash = lastCalc ? lastCalc.endingBalance : 0;
  const margin = totalGrossInflow > 0 ? ((totalNetProfit / totalGrossInflow) * 100).toFixed(1) : '0.0';

  const startCashStr = startingCash < 0 ? `-${formatPHP(Math.abs(startingCash))}` : formatPHP(startingCash);
  const netProfitStr = totalNetProfit < 0 ? `-${formatPHP(Math.abs(totalNetProfit))}` : formatPHP(totalNetProfit);
  const endCashStr = endingCash < 0 ? `-${formatPHP(Math.abs(endingCash))}` : formatPHP(endingCash);

  lines.push('"COMPACT EXECUTIVE SUMMARY"');
  lines.push('"Beginning Cash","Total Inflow (COB)","Total Outflow (Disbursed)","Net P&L","Ending Cash Balance","Shareholder Discounts (Repayable)","Airbnb Discounts (Deducted)","Total Discounts","Operating Margin"');
  lines.push(
    `"${startCashStr}","${formatPHP(totalGrossInflow)}","${formatPHP(totalExpenses)}","${netProfitStr}","${endCashStr}","${formatPHP(totalShareholderDiscounts)}","-${formatPHP(totalPlatformDiscounts)}","${formatPHP(grandTotalDiscounts)}","${margin}%"`
  );
  lines.push('');

  // Iterate over each selected month sequentially with running balance ledger
  selectedMonths.forEach((month, idx) => {
    const calc = calculations[month.id] || {
      beginningBalance: 0,
      totalPreFunding: 0,
      totalNetIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      endingBalance: 0,
      profitMargin: 0,
    };

    const rawRows = getUnifiedLedgerRows(month, partners);

    lines.push(`"${idx + 1}. ${month.name.toUpperCase()} ${year} CASH FLOW & EXPENSES"`);
    lines.push('"DATE / DESCRIPTION","CATEGORY","NOTES & DISCOUNTS","INFLOW (COB)","OUTFLOW (EXPENSES)","BALANCE"');

    // Row 1: Beginning Balance
    const prevMonthName = months[months.findIndex((m) => m.id === month.id) - 1]?.name;
    const begDesc = month.id === 'jan' ? 'Starting Capital Funds' : `Beginning Balance (from ${prevMonthName || 'Previous'})`;
    const begCat = month.id === 'jan' ? 'Beginning Cash' : 'Carried Forward';
    const begInflow = month.id === 'jan' && calc.beginningBalance > 0 ? calc.beginningBalance.toFixed(2) : '-';
    const begBalStr = calc.beginningBalance < 0 ? `-${Math.abs(calc.beginningBalance).toFixed(2)}` : calc.beginningBalance.toFixed(2);

    lines.push(
      `"${begDesc}","${begCat}","-","${begInflow}","-","${begBalStr}"`
    );

    let currentBalance = calc.beginningBalance;

    rawRows.forEach((row) => {
      currentBalance = currentBalance + row.inflow - row.outflow;
      const desc = row.date ? `"${row.date}: ${(row.description || '').replace(/"/g, '""')}"` : `"${(row.description || '').replace(/"/g, '""')}"`;
      const cat = `"${(row.category || '').replace(/"/g, '""')}"`;
      
      // Combine Notes & Discounts for unified column
      const noteParts: string[] = [];
      if (row.notes) {
        noteParts.push(row.notes);
      }
      if (row.discountAmount && row.discountAmount > 0) {
        if (row.isShareholderDiscount) {
          noteParts.push(
            row.discountMeta
              ? `[Sh Disc: ₱${row.discountAmount.toFixed(2)} (${row.discountMeta})]`
              : `[Sh Disc: ₱${row.discountAmount.toFixed(2)}]`
          );
        } else {
          noteParts.push(
            row.discountMeta
              ? `[OTA: -₱${row.discountAmount.toFixed(2)} (${row.discountMeta})]`
              : `[OTA: -₱${row.discountAmount.toFixed(2)}]`
          );
        }
      }
      const combinedNotesAndDiscounts = noteParts.length > 0
        ? `"${noteParts.join(' | ').replace(/"/g, '""')}"`
        : '"-"';

      const inflow = row.inflow > 0 ? row.inflow.toFixed(2) : '-';
      const outflow = row.outflow > 0 ? row.outflow.toFixed(2) : '-';
      const bal = currentBalance < 0 ? `-${Math.abs(currentBalance).toFixed(2)}` : currentBalance.toFixed(2);

      lines.push(`${desc},${cat},${combinedNotesAndDiscounts},"${inflow}","${outflow}","${bal}"`);
    });

    // Month Net Summary footer with separated shareholder vs platform discount indicators
    const monthShDisc = rawRows.reduce((sum, r) => sum + (r.isShareholderDiscount ? (r.discountAmount || 0) : 0), 0);
    const monthOtaDisc = rawRows.reduce((sum, r) => sum + (!r.isShareholderDiscount ? (r.discountAmount || 0) : 0), 0);
    let totalDiscStr = '"-"';
    if (monthShDisc > 0 && monthOtaDisc > 0) {
      totalDiscStr = `"Sh: ₱${monthShDisc.toFixed(2)} | OTA: -₱${monthOtaDisc.toFixed(2)}"`;
    } else if (monthShDisc > 0) {
      totalDiscStr = `"Sh: ₱${monthShDisc.toFixed(2)}"`;
    } else if (monthOtaDisc > 0) {
      totalDiscStr = `"-₱${monthOtaDisc.toFixed(2)}"`;
    }

    const endBal = calc.endingBalance < 0 ? `-${Math.abs(calc.endingBalance).toFixed(2)}` : calc.endingBalance.toFixed(2);

    lines.push(
      `"${month.name} Net Summary","Total Disbursed: ${formatPHP(calc.totalExpenses)}",${totalDiscStr},"${calc.totalNetIncome.toFixed(2)}","${calc.totalExpenses.toFixed(2)}","${endBal}"`
    );
    lines.push('');
  });

  // UTF-8 BOM for Excel compatibility
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename =
    selectedMonths.length === 1
      ? `Airbnb_Financial_${selectedMonths[0].name}_${year}.csv`
      : `Airbnb_Financial_${selectedMonths.length}Months_${year}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports current single month to CSV
 */
export function exportMonthToCSV(
  month: MonthData,
  calculations: MonthCalculations,
  year: number,
  partners?: Partner[]
): void {
  exportSelectedMonthsToCSV([month], { [month.id]: calculations }, [month.id], year, partners);
}

/**
 * Export Annual Overview table to CSV
 */
export function exportAnnualToCSV(
  months: MonthData[],
  calculations: Record<string, MonthCalculations>,
  year: number,
  partners?: Partner[]
): void {
  const allIds = months.map((m) => m.id);
  exportSelectedMonthsToCSV(months, calculations, allIds, year, partners);
}

/**
 * Captures an HTML element and triggers a high-res JPEG download
 */
export async function exportElementToJPEG(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toJpeg(element, {
    quality: 0.95,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
    fontEmbedCSS: '',
    style: {
      borderRadius: '0',
    },
  });

  const link = document.createElement('a');
  link.download = `${filename}.jpeg`;
  link.href = dataUrl;
  link.click();
}

/**
 * Captures an HTML element and triggers a crisp, multi-page PDF download
 */
export async function exportElementToPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
    fontEmbedCSS: '',
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const imgWidth = img.width;
  const imgHeight = img.height;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = (imgHeight * contentWidth) / imgWidth;

  if (contentHeight <= pageHeight - margin * 2) {
    // Single page
    pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, contentHeight);
  } else {
    // Multi-page slicing
    const pageContentHeight = pageHeight - margin * 2;
    let heightLeft = contentHeight;
    let position = margin;

    pdf.addImage(dataUrl, 'PNG', margin, position, contentWidth, contentHeight);
    heightLeft -= pageContentHeight;

    while (heightLeft > 0) {
      position = margin - (contentHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= pageContentHeight;
    }
  }

  pdf.save(`${filename}.pdf`);
}
