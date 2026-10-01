import React, { useState, useMemo, useEffect } from 'react';
import { MergedLedgerItem, TransactionType, LedgerCategory, BookingItem, Partner, ReceiptAttachment } from '../types';
import { formatPHP, parseAmount, generateId } from '../utils/formatters';
import { isPreFundingItem, isShareholderDiscount, MONTH_NAMES } from '../utils/calculations';
import { EditableCategoryCell } from './EditableCategoryCell';
import { ReceiptCell } from './ReceiptCell';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  Plus,
  Trash2,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Wrench,
  Filter,
  ChevronUp,
  ChevronDown,
  BedDouble,
  Wallet,
  Coins,
  Landmark,
  Tag,
  CheckCircle2,
} from 'lucide-react';

interface MergedLedgerTableProps {
  monthId: string;
  year?: number;
  items: MergedLedgerItem[];
  bookings?: BookingItem[];
  beginningBalance?: number;
  totalPreFunding?: number;
  prevMonthName?: string;
  nextMonthName?: string;
  isFirstMonth?: boolean;
  partners?: Partner[];
  onChange: (items: MergedLedgerItem[]) => void;
  onAddPreFunding?: () => void;
  onOpenPreFunding?: () => void;
  onOpenReimbursables?: () => void;
  onEncodeJulyStatement?: () => void;
}

interface DisplayLedgerRow {
  id: string;
  originalId: string;
  date: string;
  type: TransactionType;
  description: string;
  category: LedgerCategory | string;
  receiptNo: string;
  attachments?: ReceiptAttachment[];
  receiptImage?: string;
  receiptImageName?: string;
  inflow: number | '';
  outflow: number | '';
  netAmount: number;
  notes: string;
  isBooking: boolean;
  unit?: string;
  paidBy?: string;
  isReimbursable?: boolean;
  reimbursementStatus?: 'Pending' | 'Settled';
  settlementNotes?: string;
}

const INCOME_CATEGORIES: LedgerCategory[] = [
  'Booking Payout',
  'Direct Guest Rental',
  'Cleaning Fee Collected',
  'Extra Guest / Pet Fee',
  'Pre-Funding / Injected Funds',
  'Other Inflow',
];

const EXPENSE_CATEGORIES: LedgerCategory[] = [
  'Maintenance & Repairs',
  'Cleaning & Turnover',
  'Utilities (Electricity/Water/WiFi)',
  'Supplies & Toiletries',
  'HOA & Building Dues',
  'Platform & Payment Fees',
  'Property Management',
  'Permits & Taxes',
  'Other Outflow',
];

export const MergedLedgerTable: React.FC<MergedLedgerTableProps> = ({
  monthId,
  year = 2026,
  items,
  bookings = [],
  beginningBalance = 0,
  totalPreFunding,
  prevMonthName,
  nextMonthName,
  isFirstMonth = false,
  partners = [],
  onChange,
  onAddPreFunding,
  onOpenPreFunding,
  onOpenReimbursables,
  onEncodeJulyStatement,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'PREFUND'>('ALL');
  const monthName = MONTH_NAMES.find((m) => m.id === monthId)?.name || monthId;

  // Auto-calculated Pre-Funding (Additional Injected Funds) from items in the ledger
  const totalPreFundingInLedger = useMemo(() => {
    return items.reduce((sum, item) => {
      return isPreFundingItem(item) ? sum + parseAmount(item.inflow) : sum;
    }, 0);
  }, [items]);

  const handleAddItem = (type: TransactionType) => {
    if (isMinimized) setIsMinimized(false);
    const defaultCategory =
      type === 'Income' ? 'Other Inflow' : 'Maintenance & Repairs';

    const newItem: MergedLedgerItem = {
      id: generateId(),
      date: '',
      type,
      description: '',
      category: defaultCategory,
      receiptNo: '',
      inflow: '',
      outflow: '',
      notes: '',
    };
    onChange([...items, newItem]);
  };

  const handleQuickAddPreFund = () => {
    if (onAddPreFunding) {
      onAddPreFunding();
      return;
    }
    const defaultPartner = partners && partners.length > 0 ? 'All Owners (Split by Equity)' : 'All Owners';
    const newItem: MergedLedgerItem = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      type: 'Income',
      description: 'Owner Working Capital Pre-Funding',
      category: 'Pre-Funding / Injected Funds',
      receiptNo: '',
      inflow: '',
      outflow: '',
      notes: 'Working capital pre-funding injection',
      paidBy: defaultPartner,
    };
    onChange([...items, newItem]);
  };

  const handleQuickAddReimbursable = () => {
    const defaultPartner = (partners && partners[0]?.name) || 'Partner 1';
    const newItem: MergedLedgerItem = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      type: 'Expense',
      description: '',
      category: 'Maintenance & Repairs',
      receiptNo: '',
      inflow: '',
      outflow: '',
      notes: '',
      paidBy: defaultPartner,
      isReimbursable: true,
      reimbursementStatus: 'Pending',
    };
    onChange([...items, newItem]);
  };

  const handleUpdateRow = (
    id: string,
    field: keyof MergedLedgerItem,
    value: any
  ) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;

      const next = { ...item, [field]: value };

      // If user toggles type, adjust category and amounts logically
      if (field === 'type') {
        if (value === 'Income') {
          if (!INCOME_CATEGORIES.includes(next.category as any)) {
            next.category = 'Other Inflow';
          }
          if (next.outflow !== '') {
            next.inflow = next.outflow;
            next.outflow = '';
          }
        } else {
          if (!EXPENSE_CATEGORIES.includes(next.category as any)) {
            next.category = 'Maintenance & Repairs';
          }
          if (next.inflow !== '') {
            next.outflow = next.inflow;
            next.inflow = '';
          }
        }
      }

      // If user directly types into inflow, ensure type is Income
      if (field === 'inflow' && value !== '' && parseAmount(value) > 0) {
        next.type = 'Income';
        next.outflow = '';
      }

      // If user directly types into outflow, ensure type is Expense
      if (field === 'outflow' && value !== '' && parseAmount(value) > 0) {
        next.type = 'Expense';
        next.inflow = '';
      }

      return next;
    });
    onChange(updated);
  };

  const handleUpdateReceipt = (
    id: string,
    receiptNo: string,
    attachments: ReceiptAttachment[]
  ) => {
    const primary = attachments[0];
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        receiptNo,
        attachments,
        receiptImage: primary ? primary.url : undefined,
        receiptImageName: primary ? primary.name : undefined,
      };
    });
    onChange(updated);
  };

  const handleDeleteRow = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  // Convert bookings into automatic Income rows
  const bookingRows: DisplayLedgerRow[] = bookings.map((b) => {
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
      // Shareholder discounts do NOT reduce net payout because shareholder repays it
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
      // Platform / Airbnb discounts DO reduce net payout
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

    const unitName = b.unit || b.channel || 'Unit 1';
    const guest = b.guestName ? b.guestName : 'Guest Booking';

    const detailParts: string[] = [];
    if (b.rateMode === 'monthly' && mRate > 0) {
      detailParts.push(`${validNights} ${validNights === 1 ? 'nt' : 'nts'} @ ₱${mRate.toLocaleString()}/mo`);
    } else if (validNights > 0 && rate > 0) {
      detailParts.push(`${validNights} ${validNights === 1 ? 'nt' : 'nts'} @ ₱${rate.toLocaleString()}/nt`);
    } else if (validNights > 0) {
      detailParts.push(`${validNights} ${validNights === 1 ? 'nt' : 'nts'}`);
    } else if (rate > 0) {
      detailParts.push(`@ ₱${rate.toLocaleString()}`);
    }

    if (totalDiscount > 0) {
      const formattedDisc =
        totalDiscount % 1 === 0
          ? totalDiscount.toLocaleString()
          : totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (isShareholderDisc) {
        detailParts.push(`₱${formattedDisc} disc (${b.discountBy || 'Shareholder'} — Repayable)`);
      } else {
        detailParts.push(`-₱${formattedDisc} disc (${b.discountBy || 'Airbnb/Platform'})`);
      }
    }

    if (b.notes) {
      detailParts.push(b.notes);
    }

    const detailNotes = detailParts.join(' • ');

    const dateDisplay = b.date
      ? b.checkOutDate && b.checkOutDate !== b.date
        ? `${b.date} → ${b.checkOutDate}`
        : b.date
      : '';

    return {
      id: `booking-${b.id}`,
      originalId: b.id,
      date: b.date || '',
      type: 'Income',
      description: guest,
      category: 'Booking Payout',
      receiptNo: b.bookingRef || (validNights > 0 ? `${validNights} Nts` : 'Direct'),
      inflow: net > 0 ? net : '',
      outflow: '',
      netAmount: net,
      notes: detailNotes || dateDisplay,
      isBooking: true,
      unit: unitName,
    };
  });

  // Manual items from ledger (includes operational income, expenses, and pre-funding capital injections)
  const manualRows: DisplayLedgerRow[] = items.map((item) => {
    const inVal = parseAmount(item.inflow);
    const outVal = parseAmount(item.outflow);
    const net = item.type === 'Income' || inVal > 0 ? inVal : -outVal;

    return {
      id: item.id,
      originalId: item.id,
      date: item.date,
      type: item.type,
      description: item.description,
      category: item.category,
      receiptNo: item.receiptNo,
      attachments: item.attachments,
      receiptImage: item.receiptImage,
      receiptImageName: item.receiptImageName,
      inflow: item.inflow,
      outflow: item.outflow,
      netAmount: net,
      notes: item.notes,
      isBooking: false,
      paidBy: item.paidBy,
      isReimbursable: item.isReimbursable,
      reimbursementStatus: item.reimbursementStatus,
      settlementNotes: item.settlementNotes,
    };
  });

  // All combined rows
  const allRows = [...bookingRows, ...manualRows];

  // Helper to test if a row is pre-funding
  const isRowPreFunding = (row: DisplayLedgerRow): boolean => {
    const cat = (row.category || '').toLowerCase();
    const desc = (row.description || '').toLowerCase();
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
  };

  // Calculate discount statistics to separate shareholders vs airbnb/platform
  const { totalShareholderDiscounts, totalAirbnbDiscounts, totalAllDiscounts, shareholderBreakdown } = useMemo(() => {
    let shTotal = 0;
    let abTotal = 0;
    const breakdown: Record<string, number> = {};

    bookings.forEach((b) => {
      const discountPerNight = parseAmount(b.discount);
      const nights = typeof b.nights === 'number' && b.nights > 0 ? b.nights : parseAmount(b.nights) || 1;
      const totalDiscount = discountPerNight * nights;
      if (totalDiscount <= 0) return;

      const isShareholder = isShareholderDiscount(b.discountBy, partners);
      if (isShareholder) {
        shTotal += totalDiscount;
        const pName = b.discountBy?.trim() || 'Shareholder';
        breakdown[pName] = (breakdown[pName] || 0) + totalDiscount;
      } else {
        abTotal += totalDiscount;
      }
    });

    return {
      totalShareholderDiscounts: shTotal,
      totalAirbnbDiscounts: abTotal,
      totalAllDiscounts: shTotal + abTotal,
      shareholderBreakdown: breakdown,
    };
  }, [bookings, partners]);

  // Calculations (harmonized with MonthCalculations)
  let totalInflows = 0;
  let totalOutflows = 0;
  let preFundingInflows = 0;

  allRows.forEach((row) => {
    const inVal = parseAmount(row.inflow);
    const outVal = parseAmount(row.outflow);

    if (row.type === 'Income' || inVal > 0) {
      totalInflows += inVal;
      if (isRowPreFunding(row)) {
        preFundingInflows += inVal;
      }
    }
    if (row.type === 'Expense' || outVal > 0) {
      totalOutflows += outVal;
    }
  });

  const netLedgerFlow = totalInflows - totalOutflows;

  // Complete column totals including opening Beginning Balance shown in the table
  const openingInflow = beginningBalance >= 0 ? beginningBalance : 0;
  const openingOutflow = beginningBalance < 0 ? Math.abs(beginningBalance) : 0;
  const grandTotalInflows = openingInflow + totalInflows;
  const grandTotalOutflows = openingOutflow + totalOutflows;
  const grandTotalNet = grandTotalInflows - grandTotalOutflows;

  // Calculate running balance for each row in chronological / table order starting from beginning balance
  let currentCumulativeBalance = beginningBalance;
  const allRowsWithBalance: (DisplayLedgerRow & { runningBalance: number })[] = allRows.map((row) => {
    const inVal = parseAmount(row.inflow);
    const outVal = parseAmount(row.outflow);
    const rowInflow = row.type === 'Income' || inVal > 0 ? inVal : 0;
    const rowOutflow = row.type === 'Expense' || outVal > 0 ? outVal : 0;
    currentCumulativeBalance += rowInflow - rowOutflow;
    return {
      ...row,
      runningBalance: currentCumulativeBalance,
    };
  });

  const endingLedgerBalance = currentCumulativeBalance;

  // Filtered rows with running balance
  const filteredRows = allRowsWithBalance.filter((row) => {
    if (filterType === 'PREFUND') return isRowPreFunding(row);
    if (filterType === 'INCOME') return row.type === 'Income' || parseAmount(row.inflow) > 0;
    if (filterType === 'EXPENSE') return row.type === 'Expense' || parseAmount(row.outflow) > 0;
    return true;
  });

  const totalCount = allRows.length;
  const incomeCount = allRows.filter((r) => r.type === 'Income' || parseAmount(r.inflow) > 0).length;
  const expenseCount = allRows.filter((r) => r.type === 'Expense' || parseAmount(r.outflow) > 0).length;
  const preFundCount = allRows.filter(isRowPreFunding).length;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col mb-4">
      {/* Table Header with Filter & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <h2 className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <span>2. {monthName.toUpperCase()} {year} CASH FLOW & EXPENSES</span>
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center bg-neutral-950 p-0.5 rounded border border-neutral-800 text-[10px]">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 rounded transition-colors ${
                filterType === 'ALL'
                  ? 'bg-neutral-800 text-neutral-200 font-medium'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('INCOME')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                filterType === 'INCOME'
                  ? 'bg-emerald-950/80 text-emerald-300 font-medium'
                  : 'text-neutral-400 hover:text-emerald-400'
              }`}
            >
              <ArrowUpRight className="w-2.5 h-2.5 text-emerald-400" />
              Income ({incomeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('EXPENSE')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                filterType === 'EXPENSE'
                  ? 'bg-rose-950/80 text-rose-300 font-medium'
                  : 'text-neutral-400 hover:text-rose-400'
              }`}
            >
              <ArrowDownRight className="w-2.5 h-2.5 text-rose-400" />
              Expenses ({expenseCount})
            </button>
            {preFundCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('PREFUND')}
                className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                  filterType === 'PREFUND'
                    ? 'bg-cyan-950/90 text-cyan-300 font-semibold border border-cyan-800/80'
                    : 'text-neutral-400 hover:text-cyan-400'
                }`}
                title="Filter to Pre-Funding / Injected Capital entries"
              >
                <Landmark className="w-2.5 h-2.5 text-cyan-400" />
                Pre-Funds ({preFundCount})
              </button>
            )}
          </div>
        </div>

        {/* Upper Right Corner Controls: Add Actions & Minimize Button */}
        <div className="flex items-center gap-1.5">
          {monthId === 'jul' && onEncodeJulyStatement && (
            <button
              type="button"
              id="encode-july-stmt-btn"
              onClick={onEncodeJulyStatement}
              title="Verified Statement: 20 items (₱39,315.00 Total Outflows). Click to reload or re-encode verified statement."
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/70 border border-emerald-800/80 rounded hover:bg-emerald-900/80 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">July Statement (20 Items • ₱39,315.00)</span>
              <span className="sm:hidden">Statement (20)</span>
            </button>
          )}

          {!isMinimized && (
            <>
              <button
                type="button"
                id={`add-income-btn-${monthId}`}
                onClick={() => handleAddItem('Income')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded hover:bg-emerald-900/60 hover:text-emerald-200 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Income</span>
              </button>
              <button
                type="button"
                id={`add-expense-btn-${monthId}`}
                onClick={() => handleAddItem('Expense')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded hover:bg-rose-900/60 hover:text-rose-200 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Expense</span>
              </button>
            </>
          )}

          {isMinimized && (
            <div className="flex items-center gap-2 text-[10px] font-mono mr-1">
              <span className="text-emerald-400">+{formatPHP(totalInflows)}</span>
              <span className="text-rose-400">-{formatPHP(totalOutflows)}</span>
              <span className="text-neutral-400 font-medium">
                Balance:{' '}
                <span className={endingLedgerBalance >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {formatPHP(endingLedgerBalance)}
                </span>
              </span>
            </div>
          )}

          {/* Minimize / Expand in the Upper Right Corner */}
          <button
            type="button"
            id={`minimize-ledger-btn-${monthId}`}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand Income & Expenses Ledger' : 'Minimize Income & Expenses Ledger'}
            aria-label={isMinimized ? 'Expand Income & Expenses Ledger' : 'Minimize Income & Expenses Ledger'}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors focus:outline-none"
          >
            {isMinimized ? (
              <ChevronDown className="w-4 h-4 text-emerald-400" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Discount Summary Ribbon (Separating Shareholder Repayable Discounts vs Airbnb/OTA Platform Discounts) */}
      {!isMinimized && totalAllDiscounts > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-neutral-950/95 border-b border-neutral-800 text-[11px]">
          <div className="flex items-center gap-1.5 text-neutral-400 font-medium">
            <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
              Discounts Ledger:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Shareholder Discounts - Protected from reducing property cash */}
            {totalShareholderDiscounts > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-800/60 text-amber-300 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span className="font-semibold">Shareholders Total Discount:</span>
                <span className="font-bold text-amber-200">{formatPHP(totalShareholderDiscounts)}</span>
                {Object.entries(shareholderBreakdown).map(([name, amt]) => (
                  <span key={name} className="text-amber-400/80 text-[9px] bg-neutral-900/60 px-1 py-0.2 rounded border border-amber-900/40">
                    {name}: {formatPHP(Number(amt))}
                  </span>
                ))}
                <span className="text-neutral-400 font-sans text-[9px] italic">(Repayable by partner)</span>
              </div>
            )}

            {/* Airbnb / Platform Channel Discounts - Deducted from payout */}
            {totalAirbnbDiscounts > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950/40 border border-sky-800/60 text-sky-300 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span className="font-semibold">Airbnb / Channel Discounts:</span>
                <span className="font-bold text-sky-200">{formatPHP(totalAirbnbDiscounts)}</span>
                <span className="text-neutral-400 font-sans text-[9px] italic">(Platform promo deducted)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Responsive Compact Table (hidden when minimized) */}
      {!isMinimized && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-950/90 text-neutral-400 border-b border-neutral-800 text-[11px] font-medium select-none">
              <th className="py-2 px-2.5 w-24">Date</th>
              <th className="py-2 px-2 w-24 text-center">Type</th>
              <th className="py-2 px-2.5 min-w-[150px]">Description / Item</th>
              <th className="py-2 px-2.5 w-44">Category</th>
              <th className="py-2 px-2.5 w-24">Receipt / Ref #</th>
              <th className="py-2 px-2 w-28 text-right">Inflow (₱)</th>
              <th className="py-2 px-2 w-28 text-right">Outflow (₱)</th>
              <th className="py-2 px-2 w-28 text-right">Balance (₱)</th>
              <th className="py-2 px-2.5 min-w-[120px]">Notes</th>
              <th className="py-2 px-2 w-8 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/70">
            {/* 1. Opening Beginning Balance Row (Carried over from Previous Month) */}
            {(filterType === 'ALL' || (filterType === 'INCOME' && beginningBalance >= 0) || (filterType === 'EXPENSE' && beginningBalance < 0)) && (
              <tr className="bg-sky-950/20 hover:bg-sky-950/30 transition-colors border-b border-sky-900/40 text-neutral-200">
                <td className="py-2 px-1.5 font-mono text-[11px] text-sky-400 font-semibold">
                  01
                </td>
                <td className="py-2 px-1.5 text-center">
                  <div
                    title={isFirstMonth ? 'Initial Starting Capital' : `Carried forward from ${prevMonthName} ending balance`}
                    className="w-full py-0.5 px-1.5 rounded text-[10px] font-semibold tracking-wide uppercase flex items-center justify-center gap-1 border bg-sky-950/80 border-sky-800/80 text-sky-300 select-none"
                  >
                    <Wallet className="w-2.5 h-2.5 shrink-0" />
                    <span>Balance</span>
                  </div>
                </td>
                <td className="py-2 px-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-700/60 text-sky-200 text-[10px] font-mono shrink-0 font-medium">
                      B/F
                    </span>
                    <span className="text-[11px] text-sky-200 font-semibold truncate">
                      Beginning Balance {prevMonthName ? `(Carried over from ${prevMonthName})` : '(Starting Capital)'}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-1.5 text-[11px] text-sky-300/80 font-medium">
                  Opening Balance
                </td>
                <td className="py-2 px-1.5 font-mono text-[11px] text-neutral-400 truncate">
                  B/F
                </td>
                <td className="py-2 px-1.5 text-right font-mono-numbers text-[11px] font-bold text-sky-300">
                  {beginningBalance >= 0 ? formatPHP(beginningBalance) : '—'}
                </td>
                <td className="py-2 px-1.5 text-right font-mono-numbers text-[11px] font-bold text-rose-400">
                  {beginningBalance < 0 ? formatPHP(Math.abs(beginningBalance)) : '—'}
                </td>
                <td
                  className={`py-2 px-1.5 text-right font-mono-numbers text-[11px] font-bold ${
                    beginningBalance > 0
                      ? 'text-sky-300'
                      : beginningBalance < 0
                      ? 'text-rose-400'
                      : 'text-neutral-300'
                  }`}
                >
                  {formatPHP(beginningBalance)}
                </td>
                <td className="py-2 px-1.5 text-[11px] text-neutral-400 italic truncate" title={prevMonthName ? `Carried forward from ${prevMonthName} close` : 'Initial starting cash'}>
                  {prevMonthName ? `Carried forward from ${prevMonthName} close` : 'Initial starting cash'}
                </td>
                <td className="py-2 px-1 text-center">
                  <span
                    title={prevMonthName ? `Automated carryover from ${prevMonthName}` : 'Initial capital'}
                    className="p-1 rounded text-sky-400/80 inline-flex items-center justify-center cursor-default"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                  </span>
                </td>
              </tr>
            )}

            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-neutral-500">
                  <div className="flex flex-col items-center justify-center gap-1.5 text-xs">
                    <Receipt className="w-5 h-5 text-neutral-600" />
                    <span>
                      {allRows.length === 0
                        ? 'No new transactions or bookings recorded for this month.'
                        : 'No entries match the selected filter.'}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        type="button"
                        onClick={() => handleAddItem('Income')}
                        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 text-[11px]"
                      >
                        + Add Income
                      </button>
                      <span className="text-neutral-600">or</span>
                      <button
                        type="button"
                        onClick={() => handleAddItem('Expense')}
                        className="text-rose-400 hover:text-rose-300 underline underline-offset-2 text-[11px]"
                      >
                        + Add Expense
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                if (row.isBooking) {
                  return (
                    <tr
                      key={row.id}
                      className="bg-neutral-900/40 hover:bg-neutral-850/60 transition-colors group text-neutral-200"
                    >
                      {/* Date */}
                      <td className="py-1 px-1.5 font-mono text-[11px] text-neutral-300">
                        {row.date || '—'}
                      </td>

                      {/* Type Indicator */}
                      <td className="py-1 px-1.5 text-center">
                        <div
                          title="Auto-synced Booking Income"
                          className="w-full py-1 px-1.5 rounded text-[10px] font-semibold tracking-wide uppercase flex items-center justify-center gap-1 border bg-emerald-950/70 border-emerald-800/80 text-emerald-300 select-none"
                        >
                          <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                          <span>Income</span>
                        </div>
                      </td>

                      {/* Description with Unit Pill */}
                      <td className="py-1 px-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/70 text-sky-300 text-[10px] font-mono shrink-0 font-medium">
                            {row.unit}
                          </span>
                          <span className="text-[11px] text-neutral-200 font-medium truncate">
                            {row.description}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-1 px-1.5">
                        <span className="text-[11px] text-neutral-300">
                          Booking Payout
                        </span>
                      </td>

                      {/* Receipt / Booking Ref */}
                      <td className="py-1 px-1.5 font-mono text-[11px] text-neutral-300 truncate">
                        {row.receiptNo || 'Direct'}
                      </td>

                      {/* Inflow (Net Payout) */}
                      <td className="py-1 px-1.5 text-right font-mono-numbers text-[11px] font-semibold text-emerald-300">
                        {formatPHP(parseAmount(row.inflow))}
                      </td>

                      {/* Outflow */}
                      <td className="py-1 px-1.5 text-right font-mono-numbers text-[11px] text-neutral-600">
                        —
                      </td>

                      {/* Real-time Running Balance */}
                      <td className="py-1 px-1.5 text-right font-mono-numbers text-[11px] font-semibold">
                        <span
                          className={
                            row.runningBalance > 0
                              ? 'text-emerald-400'
                              : row.runningBalance < 0
                              ? 'text-rose-400'
                              : 'text-neutral-300'
                          }
                        >
                          {formatPHP(row.runningBalance)}
                        </span>
                      </td>

                      {/* Notes breakdown */}
                      <td className="py-1 px-1.5 text-[10px] text-neutral-400 truncate" title={row.notes}>
                        {row.notes || '—'}
                      </td>

                      {/* Action - Auto Indicator */}
                      <td className="py-1 px-1 text-center">
                        <span
                          title={`Auto-synced from Bookings table (${row.unit})`}
                          className="p-1 rounded text-sky-400 bg-sky-950/60 border border-sky-800/60 inline-flex items-center justify-center cursor-default"
                        >
                          <BedDouble className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                }

                const isIncome = row.type === 'Income';
                const isPreFunding =
                  (row.category || '').toLowerCase().includes('pre-fund') ||
                  (row.category || '').toLowerCase().includes('prefund') ||
                  (row.category || '').toLowerCase().includes('injected') ||
                  (row.category || '').toLowerCase().includes('capital injection') ||
                  (row.description || '').toLowerCase().includes('pre-fund') ||
                  (row.description || '').toLowerCase().includes('prefund') ||
                  (row.description || '').toLowerCase().includes('injected funds');
                const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

                const netRow = isIncome
                  ? parseAmount(row.inflow)
                  : -parseAmount(row.outflow);

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-neutral-850/60 transition-colors group text-neutral-200 ${
                      isPreFunding ? 'bg-cyan-950/10' : ''
                    }`}
                  >
                    {/* Date */}
                    <td className="py-1 px-1.5">
                      <input
                        type="date"
                        aria-label={`Transaction Date row ${index + 1}`}
                        value={row.date}
                        onChange={(e) => handleUpdateRow(row.originalId, 'date', e.target.value)}
                        className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-1.5 py-1 text-[11px] text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 focus:bg-neutral-900"
                      />
                    </td>

                    {/* Type Toggle Button */}
                    <td className="py-1 px-1.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateRow(row.originalId, 'type', isIncome ? 'Expense' : 'Income')
                        }
                        title={
                          isPreFunding
                            ? 'Pre-Funding / Injected Capital (Click to toggle type)'
                            : 'Click to toggle between Income and Expense'
                        }
                        className={`w-full py-1 px-1.5 rounded text-[10px] font-semibold tracking-wide uppercase transition-colors flex items-center justify-center gap-1 border ${
                          isPreFunding
                            ? 'bg-cyan-950/80 border-cyan-800/90 text-cyan-300 hover:bg-cyan-900/70'
                            : isIncome
                            ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/60'
                            : 'bg-rose-950/70 border-rose-800/80 text-rose-300 hover:bg-rose-900/60'
                        }`}
                      >
                        {isPreFunding ? (
                          <>
                            <ArrowUpRight className="w-2.5 h-2.5 shrink-0 text-cyan-400" />
                            <span>Pre-Fund</span>
                          </>
                        ) : isIncome ? (
                          <>
                            <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                            <span>Income</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownRight className="w-2.5 h-2.5 shrink-0" />
                            <span>Expense</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Description */}
                    <td className="py-1 px-1.5">
                      <input
                        type="text"
                        aria-label={`Transaction Description row ${index + 1}`}
                        placeholder={
                          isPreFunding
                            ? 'e.g. Owner Working Capital Pre-Funding'
                            : isIncome
                            ? 'e.g. Direct booking, Cleaning fee collected'
                            : 'e.g. AC Cleaning, Meralco bill, Linen replacement'
                        }
                        value={row.description}
                        onChange={(e) =>
                          handleUpdateRow(row.originalId, 'description', e.target.value)
                        }
                        className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-[11px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 focus:bg-neutral-900"
                      />
                    </td>

                    {/* Category */}
                    <td className="py-1 px-1.5">
                      <EditableCategoryCell
                        ariaLabel={`Category row ${index + 1}`}
                        value={row.category}
                        isIncome={isIncome}
                        isPreFunding={isPreFunding}
                        onChange={(newCategory) => handleUpdateRow(row.originalId, 'category', newCategory)}
                        size="xs"
                      />
                    </td>

                    {/* Receipt / Ref # */}
                    <td className="py-1 px-1.5">
                      <ReceiptCell
                        ariaLabel={`Receipt Ref row ${index + 1}`}
                        receiptNo={row.receiptNo}
                        attachments={row.attachments}
                        receiptImage={row.receiptImage}
                        receiptImageName={row.receiptImageName}
                        description={row.description}
                        date={row.date}
                        amount={isIncome ? row.inflow : row.outflow}
                        isIncome={isIncome}
                        category={row.category}
                        onUpdateReceipt={(newNo, newAtts) =>
                          handleUpdateReceipt(row.originalId, newNo, newAtts)
                        }
                        size="xs"
                      />
                    </td>

                    {/* Inflow (₱) */}
                    <td className="py-1 px-1.5">
                      <div className="relative">
                        <span
                          className={`absolute left-1.5 top-1 text-[10px] font-mono ${
                            isPreFunding ? 'text-cyan-400' : 'text-emerald-500'
                          }`}
                        >
                          ₱
                        </span>
                        <FormattedAmountInput
                          aria-label={`Inflow Amount row ${index + 1}`}
                          placeholder="0.00"
                          value={row.inflow}
                          disabled={!isIncome && row.inflow === ''}
                          onChange={(val) =>
                            handleUpdateRow(row.originalId, 'inflow', val)
                          }
                          className={`w-full pl-4 pr-1.5 py-1 rounded text-[11px] text-right font-mono-numbers placeholder-neutral-700 focus:outline-none focus:ring-1 ${
                            isPreFunding
                              ? 'bg-cyan-950/20 border border-cyan-800/60 text-cyan-300 font-semibold focus:border-cyan-400 focus:ring-cyan-400'
                              : isIncome
                              ? 'bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 focus:border-emerald-400 focus:ring-emerald-400'
                              : 'bg-neutral-950/40 border border-neutral-900 text-neutral-600 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Outflow (₱) */}
                    <td className="py-1 px-1.5">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-rose-500 text-[10px] font-mono">
                          ₱
                        </span>
                        <FormattedAmountInput
                          aria-label={`Outflow Amount row ${index + 1}`}
                          placeholder="0.00"
                          value={row.outflow}
                          disabled={isIncome && row.outflow === ''}
                          onChange={(val) =>
                            handleUpdateRow(row.originalId, 'outflow', val)
                          }
                          className={`w-full pl-4 pr-1.5 py-1 rounded text-[11px] text-right font-mono-numbers placeholder-neutral-700 focus:outline-none focus:ring-1 ${
                            !isIncome
                              ? 'bg-rose-950/20 border border-rose-800/40 text-rose-300 focus:border-rose-400 focus:ring-rose-400'
                              : 'bg-neutral-950/40 border border-neutral-900 text-neutral-600 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Real-time Running Balance */}
                    <td className="py-1 px-1.5 text-right font-mono-numbers text-[11px]">
                      <span
                        className={`font-semibold ${
                          row.runningBalance > 0
                            ? 'text-emerald-400'
                            : row.runningBalance < 0
                            ? 'text-rose-400'
                            : 'text-neutral-300'
                        }`}
                      >
                        {formatPHP(row.runningBalance)}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="py-1 px-1.5">
                      <input
                        type="text"
                        aria-label={`Notes row ${index + 1}`}
                        placeholder="Remarks"
                        value={row.notes}
                        onChange={(e) => handleUpdateRow(row.originalId, 'notes', e.target.value)}
                        className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-[11px] text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 focus:bg-neutral-900"
                      />
                    </td>

                    {/* Action */}
                    <td className="py-1 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.originalId)}
                        aria-label="Delete transaction"
                        className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors opacity-70 group-hover:opacity-100"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Automated Totals & Ending Balance Rows */}
          {(allRows.length > 0 || beginningBalance !== 0) && (
            <tfoot>
              {/* Row 1: Totals matching the columns */}
              <tr className="bg-neutral-950/90 font-semibold text-neutral-200 border-t-2 border-neutral-800 text-[11px]">
                <td colSpan={5} className="py-2 px-2.5 text-right uppercase tracking-wider text-neutral-400 text-[10px]">
                  <div className="flex items-center justify-end gap-2">
                    {totalAllDiscounts > 0 && (
                      <span className="text-[10px] text-neutral-400 font-normal lowercase">
                        (Discounts: {totalShareholderDiscounts > 0 && `₱${totalShareholderDiscounts.toLocaleString()} shareholders`}
                        {totalShareholderDiscounts > 0 && totalAirbnbDiscounts > 0 && ' | '}
                        {totalAirbnbDiscounts > 0 && `₱${totalAirbnbDiscounts.toLocaleString()} airbnb`})
                      </span>
                    )}
                    <span>Total</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono-numbers text-emerald-400">
                  <div className="font-bold text-xs">{formatPHP(grandTotalInflows)}</div>
                </td>
                <td className="py-2 px-2 text-right font-mono-numbers text-rose-400">
                  <div className="font-bold text-xs">{formatPHP(grandTotalOutflows)}</div>
                </td>
                <td className="py-2 px-2 text-right font-mono-numbers">
                  <div
                    className={`font-bold text-xs ${
                      endingLedgerBalance > 0
                        ? 'text-emerald-400'
                        : endingLedgerBalance < 0
                        ? 'text-rose-400'
                        : 'text-neutral-200'
                    }`}
                  >
                    {formatPHP(endingLedgerBalance)}
                  </div>
                </td>
                <td colSpan={2} className="py-2 px-2.5 text-[10px]"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}
    </div>
  );
};
