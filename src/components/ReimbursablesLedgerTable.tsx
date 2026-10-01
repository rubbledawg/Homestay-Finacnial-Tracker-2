import React, { useState, useMemo, useEffect } from 'react';
import { MergedLedgerItem, Partner, LedgerCategory, ReceiptAttachment } from '../types';
import { formatPHP, parseAmount, generateId } from '../utils/formatters';
import {
  calculatePartnerReimbursableDebts,
  getItemPartnerDebtBreakdown,
} from '../utils/calculations';
import { EditableCategoryCell } from './EditableCategoryCell';
import { ReceiptCell } from './ReceiptCell';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Check,
  Building2,
  FileCheck2,
  ArrowRightLeft,
} from 'lucide-react';

interface ReimbursablesLedgerTableProps {
  monthId: string;
  monthName: string;
  items: MergedLedgerItem[];
  partners: Partner[];
  onChange: (items: MergedLedgerItem[]) => void;
  onOpenPartnersModal?: () => void;
}

interface PartnerStat {
  total: number;
  pending: number;
  settled: number;
}

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

export const ReimbursablesLedgerTable: React.FC<ReimbursablesLedgerTableProps> = ({
  monthId,
  monthName,
  items,
  partners,
  onChange,
  onOpenPartnersModal,
}) => {
  const [isMinimized, setIsMinimized] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');

  // Reset to closed/hidden by default when switching months
  useEffect(() => {
    setIsMinimized(true);
  }, [monthId]);

  // Filter items to only reimbursables (or out-of-pocket expenses paid by partners)
  const reimbursableItems = useMemo(() => {
    return items.filter((item) => {
      // Must be an expense and explicitly flagged as reimbursable or paid by a partner (other than Property Funds)
      const isExp = item.type === 'Expense' || parseAmount(item.outflow) > 0;
      const isMarked = item.isReimbursable === true;
      const hasPartner = item.paidBy && item.paidBy !== 'Property Funds' && item.paidBy !== 'Property Fund';
      return isExp && (isMarked || Boolean(hasPartner));
    });
  }, [items]);

  // Partner equity debt calculations based on shares
  const debtCalculations = useMemo(() => {
    return calculatePartnerReimbursableDebts(items, partners);
  }, [items, partners]);

  // Backward compatibility totals
  const totals = useMemo(() => {
    return {
      totalAmount: debtCalculations.totalAmount,
      totalPending: debtCalculations.totalPending,
      totalSettled: debtCalculations.totalSettled,
      byPartner: debtCalculations.debts,
    };
  }, [debtCalculations]);

  const handleAddReimbursable = () => {
    const defaultPartner = partners[0]?.name || 'Partner 1';
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
      settlementNotes: '',
    };
    onChange([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof MergedLedgerItem, value: any) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };

      // Ensure reimbursable flag is active
      next.isReimbursable = true;
      next.type = 'Expense';

      // If toggling status to Settled, auto-fill settlement date if blank
      if (field === 'reimbursementStatus' && value === 'Settled' && !next.settlementDate) {
        next.settlementDate = new Date().toISOString().slice(0, 10);
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
        isReimbursable: true,
        type: 'Expense' as const,
      };
    });
    onChange(updated);
  };

  const handleToggleStatus = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const newStatus = target.reimbursementStatus === 'Settled' ? 'Pending' : 'Settled';
    handleUpdateItem(id, 'reimbursementStatus', newStatus);
  };

  const handleSettleAllPending = () => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = items.map((item) => {
      if (reimbursableItems.some((r) => r.id === item.id) && item.reimbursementStatus !== 'Settled') {
        return {
          ...item,
          reimbursementStatus: 'Settled' as const,
          settlementDate: item.settlementDate || today,
          settlementNotes: item.settlementNotes || 'Batch settled',
        };
      }
      return item;
    });
    onChange(updated);
  };

  const handleDeleteItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  // Filtered rows
  const filteredItems = useMemo(() => {
    return reimbursableItems.filter((item) => {
      if (statusFilter === 'PENDING' && item.reimbursementStatus === 'Settled') return false;
      if (statusFilter === 'SETTLED' && item.reimbursementStatus !== 'Settled') return false;
      if (partnerFilter !== 'ALL' && (item.paidBy || '').trim() !== partnerFilter) return false;
      return true;
    });
  }, [reimbursableItems, statusFilter, partnerFilter]);

  const pendingCount = reimbursableItems.filter((r) => r.reimbursementStatus !== 'Settled').length;
  const settledCount = reimbursableItems.filter((r) => r.reimbursementStatus === 'Settled').length;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col mb-4 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <h2 className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
            Reimbursables Ledger
          </h2>

          {/* Status Filter Pills */}
          <div className="hidden sm:flex items-center bg-neutral-950 p-0.5 rounded border border-neutral-800 text-[10px] ml-1">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-0.5 rounded transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-neutral-800 text-neutral-200 font-medium'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              All ({reimbursableItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-950/90 text-amber-300 font-medium border border-amber-800/80'
                  : 'text-neutral-400 hover:text-amber-400'
              }`}
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>Pending ({pendingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SETTLED')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === 'SETTLED'
                  ? 'bg-emerald-950/90 text-emerald-300 font-medium border border-emerald-800/80'
                  : 'text-neutral-400 hover:text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span>Settled ({settledCount})</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {!isMinimized && (
            <>
              {pendingCount > 1 && (
                <button
                  type="button"
                  onClick={handleSettleAllPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/70 border border-emerald-800/70 rounded hover:bg-emerald-900/80 transition-colors cursor-pointer"
                  title="Mark all pending reimbursables for this month as Settled"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Settle All</span>
                </button>
              )}

              <button
                type="button"
                id={`add-reimbursable-btn-${monthId}`}
                onClick={handleAddReimbursable}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-950/70 border border-amber-800/80 rounded hover:bg-amber-900/80 hover:text-amber-200 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm cursor-pointer"
                title="Record an out-of-pocket expense paid by a partner"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Partner Expense</span>
              </button>
            </>
          )}

          {/* Quick Metrics when minimized */}
          {isMinimized && (
            <div className="flex items-center gap-2 text-[10px] font-mono mr-1">
              <span className="text-amber-400">Pending: {formatPHP(totals.totalPending)}</span>
              <span className="text-emerald-400">Settled: {formatPHP(totals.totalSettled)}</span>
            </div>
          )}

          {/* Minimize toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand Reimbursables Ledger' : 'Minimize Reimbursables Ledger'}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors focus:outline-none"
          >
            {isMinimized ? (
              <ChevronDown className="w-4 h-4 text-amber-400" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Inter-Partner Reimbursement Settlement Banner */}
          <div className="px-3 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex flex-col gap-2 text-xs">
            <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded p-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                <div className="p-1.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-400 shrink-0">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-neutral-100 uppercase tracking-wider">
                      Partner Reimbursement Split
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800/80 text-amber-300 text-[10px] font-mono">
                      Calculated by Equity Share %
                    </span>
                  </div>
                  <p className="text-xs text-amber-200 font-medium mt-0.5">
                    🤝 {debtCalculations.settlementSummary}
                  </p>
                </div>
              </div>

              {/* Partner Share Position Cards */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                {debtCalculations.debtsList.map((d) => {
                  const isCreditor = d.netPendingBalance > 0.01;
                  const isDebtor = d.netPendingBalance < -0.01;
                  return (
                    <div
                      key={d.partner.id}
                      className={`flex-1 md:flex-initial px-2.5 py-1.5 rounded border text-xs flex flex-col justify-between min-w-[170px] ${
                        isCreditor
                          ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                          : isDebtor
                          ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] mb-0.5">
                        <span className="font-semibold text-neutral-200">{d.partner.name}</span>
                        <span className="text-neutral-400 font-mono text-[10px]">({d.partner.sharePercentage}%)</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-neutral-400 text-[10px]">Paid: {formatPHP(d.pendingPaid)}</span>
                        <span
                          className={`font-mono-numbers font-semibold ${
                            isCreditor
                              ? 'text-emerald-400'
                              : isDebtor
                              ? 'text-amber-300'
                              : 'text-neutral-400'
                          }`}
                        >
                          {isCreditor
                            ? `Is Owed +${formatPHP(d.netPendingBalance)}`
                            : isDebtor
                            ? `Owes ${formatPHP(Math.abs(d.netPendingBalance))}`
                            : 'Balanced'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reimbursables Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-950/90 text-neutral-400 border-b border-neutral-800 text-[11px] font-medium select-none">
                  <th className="py-2 px-2.5 w-24">Date</th>
                  <th className="py-2 px-2.5 w-40">Paid By (Partner)</th>
                  <th className="py-2 px-2.5 min-w-[150px]">Expense Description</th>
                  <th className="py-2 px-2.5 w-40">Category</th>
                  <th className="py-2 px-2.5 w-20">Receipt #</th>
                  <th className="py-2 px-2.5 w-28 text-right">Amount (₱)</th>
                  <th className="py-2 px-2.5 w-48 text-right">Owed by Other Partner(s)</th>
                  <th className="py-2 px-2.5 w-32 text-center">Status</th>
                  <th className="py-2 px-2.5 min-w-[140px]">Settlement Notes</th>
                  <th className="py-2 px-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/70">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-neutral-400 bg-neutral-950/20">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Coins className="w-6 h-6 text-neutral-600" />
                        <span className="text-xs text-neutral-300 font-medium">
                          No partner reimbursables recorded for {monthName} yet.
                        </span>
                        <p className="text-[11px] text-neutral-400 max-w-md">
                          If a partner pays an expense out of pocket, record it here to track reimbursements and automatically include it in property expenses.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddReimbursable}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 rounded text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Record First Partner Expense</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const isSettled = item.reimbursementStatus === 'Settled';
                    const amount = parseAmount(item.outflow);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-neutral-850/60 transition-colors group text-neutral-200 ${
                          isSettled ? 'bg-neutral-950/30' : 'bg-amber-950/10'
                        }`}
                      >
                        {/* Date */}
                        <td className="py-1.5 px-2">
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-amber-500 rounded-none px-1 py-0.5 text-xs text-neutral-200 font-mono focus:outline-none focus:bg-neutral-900"
                          />
                        </td>

                        {/* Paid By (Partner dropdown) */}
                        <td className="py-1.5 px-2">
                          <select
                            value={item.paidBy || (partners[0]?.name || 'Partner 1')}
                            onChange={(e) => handleUpdateItem(item.id, 'paidBy', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-neutral-200 font-medium focus:outline-none focus:border-amber-500"
                          >
                            {partners.map((p) => (
                              <option key={p.id} value={p.name} className="bg-neutral-900 text-neutral-200">
                                {p.name} ({p.sharePercentage}%)
                              </option>
                            ))}
                            {/* Fallback option if custom text */}
                            {item.paidBy && !partners.some((p) => p.name === item.paidBy) && (
                              <option value={item.paidBy} className="bg-neutral-900 text-neutral-200">
                                {item.paidBy}
                              </option>
                            )}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                            placeholder="e.g. Aircon repair, water heater replacement..."
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-amber-500 rounded-none px-1 py-0.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:bg-neutral-900"
                          />
                        </td>

                        {/* Category */}
                        <td className="py-1.5 px-2">
                          <EditableCategoryCell
                            ariaLabel={`Category row ${index + 1}`}
                            value={item.category}
                            isIncome={false}
                            onChange={(newCategory) => handleUpdateItem(item.id, 'category', newCategory)}
                            size="sm"
                          />
                        </td>

                        {/* Receipt / Invoice # */}
                        <td className="py-1.5 px-2">
                          <ReceiptCell
                            ariaLabel={`Receipt Ref row ${index + 1}`}
                            receiptNo={item.receiptNo || ''}
                            attachments={item.attachments}
                            receiptImage={item.receiptImage}
                            receiptImageName={item.receiptImageName}
                            description={item.description}
                            date={item.date}
                            amount={item.outflow}
                            isIncome={false}
                            category={item.category}
                            onUpdateReceipt={(newNo, newAtts) =>
                              handleUpdateReceipt(item.id, newNo, newAtts)
                            }
                            size="sm"
                          />
                        </td>

                        {/* Outflow Amount (₱) */}
                        <td className="py-1.5 px-2 text-right">
                          <FormattedAmountInput
                            value={item.outflow === '' ? '' : item.outflow}
                            onChange={(val) => handleUpdateItem(item.id, 'outflow', val)}
                            placeholder="0.00"
                            className="w-full text-right bg-transparent border-0 border-b border-transparent focus:border-rose-500 rounded-none px-1 py-0.5 text-xs font-mono-numbers text-rose-400 font-semibold placeholder-neutral-600 focus:outline-none focus:bg-neutral-900"
                          />
                        </td>

                        {/* Owed by Other Partner(s) */}
                        <td className="py-1.5 px-2 text-right">
                          {(() => {
                            const breakdown = getItemPartnerDebtBreakdown(item, partners);
                            if (breakdown.debts.length === 0) {
                              return <span className="text-[11px] text-neutral-500 font-mono">—</span>;
                            }
                            return (
                              <div className="flex flex-col items-end leading-tight">
                                {breakdown.debts.map((d) => (
                                  <div key={d.partner.id} className="flex items-center gap-1.5 justify-end">
                                    <span
                                      className={`font-mono-numbers text-xs font-semibold ${
                                        isSettled ? 'text-emerald-400' : 'text-amber-300'
                                      }`}
                                      title={`${d.partner.name}'s equity share (${d.partner.sharePercentage}%)`}
                                    >
                                      {formatPHP(d.amountOwed)}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-medium">
                                      ({d.partner.name} {d.partner.sharePercentage}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Status Interactive Badge */}
                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item.id)}
                            className={`inline-flex items-center justify-center gap-1.5 py-1 px-2.5 rounded text-[11px] font-semibold tracking-wide border transition-all cursor-pointer whitespace-nowrap ${
                              isSettled
                                ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80'
                                : 'bg-amber-950/80 border-amber-700/80 text-amber-300 hover:bg-amber-900/80 shadow-sm'
                            }`}
                            title={isSettled ? 'Click to mark as Pending' : 'Click to mark as Settled / Paid back'}
                          >
                            {isSettled ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>Settled</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>Pending Owed</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Settlement Notes / Proof */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.settlementNotes || item.notes || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'settlementNotes', e.target.value)}
                            placeholder={isSettled ? 'e.g. GCash paid 9/5' : 'Payment arrangement / note...'}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-amber-500 rounded-none px-1 py-0.5 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:bg-neutral-900"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-neutral-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete this reimbursable expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot>
                  <tr className="bg-neutral-950 font-semibold text-neutral-100 border-t-2 border-neutral-800 text-xs">
                    <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider text-[11px] text-neutral-400">
                      Reimbursables Total ({monthName})
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono-numbers text-rose-400 text-sm">
                      {formatPHP(totals.totalAmount)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex flex-col items-end text-[11px] font-mono leading-tight">
                        {debtCalculations.debtsList
                          .filter((d) => d.netPendingBalance < -0.01)
                          .map((d) => (
                            <span key={d.partner.id} className="text-amber-300 font-semibold">
                              {d.partner.name} owes: {formatPHP(Math.abs(d.netPendingBalance))}
                            </span>
                          ))}
                        {debtCalculations.totalPending === 0 && (
                          <span className="text-emerald-400 font-medium">All settled</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-[11px] font-mono text-amber-300">
                        {formatPHP(totals.totalPending)} pending
                      </span>
                    </td>
                    <td colSpan={2} className="py-2.5 px-2 text-[11px] text-neutral-400">
                      Included in property expenses & P&L
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Clarification footnote */}
          <div className="px-3 py-2 bg-neutral-950/60 border-t border-neutral-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                All partner out-of-pocket expenses are directly synchronized into the property's main Income & Expenses ledger.
              </span>
            </div>
            {onOpenPartnersModal && (
              <button
                type="button"
                onClick={onOpenPartnersModal}
                className="text-emerald-400 hover:underline cursor-pointer"
              >
                Configure partners & equity shares →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
