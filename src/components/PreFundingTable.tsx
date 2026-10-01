import React, { useState, useMemo, useEffect } from 'react';
import { MergedLedgerItem, Partner, ReceiptAttachment } from '../types';
import { formatPHP, parseAmount, generateId } from '../utils/formatters';
import { isPreFundingItem } from '../utils/calculations';
import { ReceiptCell } from './ReceiptCell';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  Landmark,
  Trash2,
  ChevronDown,
  ChevronUp,
  Split,
  X,
  Sparkles,
} from 'lucide-react';

interface PreFundingTableProps {
  monthId: string;
  monthName: string;
  items: MergedLedgerItem[];
  partners: Partner[];
  onChange: (newLedger: MergedLedgerItem[]) => void;
  onOpenPartnersModal: () => void;
}

export const PreFundingTable: React.FC<PreFundingTableProps> = ({
  monthId,
  monthName,
  items,
  partners,
  onChange,
  onOpenPartnersModal,
}) => {
  const [isMinimized, setIsMinimized] = useState(true);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitTotalAmount, setSplitTotalAmount] = useState<number | ''>(50000);
  const [splitDescription, setSplitDescription] = useState<string>('Owner Working Capital Pre-Funding');
  const [splitDate, setSplitDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [splitCreationMode, setSplitCreationMode] = useState<'individual' | 'consolidated'>('individual');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');

  // Reset to closed/hidden by default when switching months
  useEffect(() => {
    setIsMinimized(true);
  }, [monthId]);

  // Filter items to only pre-funding items
  const preFundingItems = useMemo(() => {
    return items.filter(isPreFundingItem);
  }, [items]);

  // Total pre-funding amount
  const totalPreFunding = useMemo(() => {
    return preFundingItems.reduce((sum, item) => sum + parseAmount(item.inflow), 0);
  }, [preFundingItems]);

  // Total partner share sum (usually 100%)
  const totalShares = useMemo(() => {
    return partners.reduce((sum, p) => sum + (p.sharePercentage || 0), 0) || 100;
  }, [partners]);

  // Filtered pre-funding items
  const filteredItems = useMemo(() => {
    if (partnerFilter === 'ALL') return preFundingItems;
    return preFundingItems.filter((item) => {
      const paidBy = (item.paidBy || '').trim();
      if (partnerFilter === 'SPLIT') {
        return (
          !paidBy ||
          paidBy.toLowerCase().includes('all owner') ||
          paidBy.toLowerCase().includes('split')
        );
      }
      return paidBy.toLowerCase() === partnerFilter.toLowerCase();
    });
  }, [preFundingItems, partnerFilter]);

  // Execute quick split injection
  const handleConfirmSplitInjection = () => {
    const totalVal = parseAmount(splitTotalAmount);
    if (totalVal <= 0) return;

    const dateVal = splitDate || new Date().toISOString().slice(0, 10);
    const desc = splitDescription || 'Owner Working Capital Pre-Funding';

    if (splitCreationMode === 'individual' && partners.length > 0) {
      // Create separate line item for each partner proportionally
      const newItems: MergedLedgerItem[] = partners.map((p) => {
        const pShare = (totalVal * (p.sharePercentage || 0)) / totalShares;
        return {
          id: generateId(),
          date: dateVal,
          type: 'Income',
          description: `${desc} — ${p.name} (${p.sharePercentage}%)`,
          category: 'Pre-Funding / Injected Funds',
          receiptNo: '',
          inflow: Math.round(pShare * 100) / 100,
          outflow: '',
          notes: `${p.sharePercentage}% equity injection`,
          paidBy: p.name,
        };
      });
      onChange([...items, ...newItems]);
    } else {
      // Create single consolidated item
      const newItem: MergedLedgerItem = {
        id: generateId(),
        date: dateVal,
        type: 'Income',
        description: desc,
        category: 'Pre-Funding / Injected Funds',
        receiptNo: '',
        inflow: totalVal,
        outflow: '',
        notes: `Split across owners according to equity share percentages`,
        paidBy: 'All Owners (Split by Share %)',
      };
      onChange([...items, newItem]);
    }

    setIsSplitModalOpen(false);
  };

  // Update a field on a specific item
  const handleUpdateItem = (id: string, field: keyof MergedLedgerItem, value: any) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        [field]: value,
        category: 'Pre-Funding / Injected Funds',
        type: 'Income' as const,
      };
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
        category: 'Pre-Funding / Injected Funds',
        type: 'Income' as const,
      };
    });
    onChange(updated);
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div
      id="prefunding-table-container"
      className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col mb-4 transition-all shadow-md"
    >
      {/* Table Header Banner */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-xs gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <h2 className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
            Pre-Funding Ledger
          </h2>
          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] font-mono">
            {preFundingItems.length} {preFundingItems.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* Right Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Total Injected Badge */}
          <div className="px-2.5 py-1 rounded bg-neutral-950 border border-neutral-800 flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
              Total Injected:
            </span>
            <span className="text-xs font-bold font-mono-numbers text-cyan-400">
              {formatPHP(totalPreFunding)}
            </span>
          </div>

          {/* Quick Split by Owner Equity */}
          <button
            id="quick-split-prefunding-btn"
            type="button"
            onClick={() => setIsSplitModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition-colors cursor-pointer"
            title="Split a capital injection amount across all owners according to equity share percentages"
          >
            <Split className="w-3.5 h-3.5" />
            <span>+ Split by Owner Equity</span>
          </button>

          {/* Minimize / Maximize toggle */}
          <button
            id="toggle-prefunding-minimize-btn"
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
            title={isMinimized ? 'Expand table' : 'Collapse table'}
          >
            {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Filter Bar */}
          <div className="px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 font-medium">Filter By:</span>
              <div className="inline-flex rounded bg-neutral-950 border border-neutral-800 p-0.5 text-[11px] gap-0.5">
                <button
                  type="button"
                  onClick={() => setPartnerFilter('ALL')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    partnerFilter === 'ALL'
                      ? 'bg-neutral-800 text-neutral-100 font-medium'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  All ({preFundingItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerFilter('SPLIT')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    partnerFilter === 'SPLIT'
                      ? 'bg-cyan-950/80 text-cyan-300 font-medium border border-cyan-800/60'
                      : 'text-neutral-400 hover:text-cyan-400'
                  }`}
                >
                  Split Injections
                </button>
                {partners.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPartnerFilter(p.name)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      partnerFilter === p.name
                        ? 'bg-neutral-800 text-neutral-100 font-medium'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {p.name} ({p.sharePercentage}%)
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenPartnersModal}
                className="text-[11px] text-neutral-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Owner Shares ({partners.map((p) => `${p.name} ${p.sharePercentage}%`).join(', ')})
              </button>
              <div className="text-[11px] text-neutral-500 font-mono hidden sm:block">
                Added to opening cash & sequential carryover
              </div>
            </div>
          </div>

          {/* Pre-Funding Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-950/90 text-neutral-400 border-b border-neutral-800 text-[11px] font-medium select-none">
                  <th className="py-2 px-2 text-center w-8">#</th>
                  <th className="py-2 px-2.5 w-28">Date</th>
                  <th className="py-2 px-2.5 w-48">Contributed By</th>
                  <th className="py-2 px-2.5 min-w-[180px]">Purpose / Description</th>
                  <th className="py-2 px-2.5 text-right w-32">Amount (₱)</th>
                  <th className="py-2 px-2.5 min-w-[200px]">Owner Percentage Share</th>
                  <th className="py-2 px-2 w-36">Receipt / Ref #</th>
                  <th className="py-2 px-2 min-w-[140px]">Notes</th>
                  <th className="py-2 px-1 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Landmark className="w-8 h-8 text-neutral-600 mb-1 stroke-1" />
                        <span className="text-xs font-medium text-neutral-400">
                          No pre-funding capital injections recorded for {monthName}
                        </span>
                        <p className="text-[11px] text-neutral-500 max-w-md">
                          Pre-funds are split across shareholders depending on their share percentage.
                          Click below to inject and automatically split by equity.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setIsSplitModalOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition-colors cursor-pointer"
                          >
                            <Split className="w-3.5 h-3.5" />
                            <span>+ Split by Owner Equity</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const amt = parseAmount(item.inflow);
                    const paidBy = (item.paidBy || '').trim();
                    const isSplitAll =
                      !paidBy ||
                      paidBy.toLowerCase().includes('all owner') ||
                      paidBy.toLowerCase().includes('split');

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-neutral-850/50 transition-colors group text-neutral-200 text-xs"
                      >
                        {/* 1. Index */}
                        <td className="py-1.5 px-2 text-center text-neutral-500 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* 2. Date */}
                        <td className="py-1.5 px-2">
                          <input
                            type="date"
                            aria-label={`Date row ${index + 1}`}
                            value={item.date}
                            onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)}
                            className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-neutral-300 focus:outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* 3. Contributed By */}
                        <td className="py-1.5 px-2">
                          <select
                            aria-label={`Contributed by row ${index + 1}`}
                            value={item.paidBy || 'All Owners (Split by Share %)'}
                            onChange={(e) => handleUpdateItem(item.id, 'paidBy', e.target.value)}
                            className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-xs font-medium text-neutral-200 focus:outline-none focus:border-cyan-500"
                          >
                            <option value="All Owners (Split by Share %)">
                              All Owners (Split by Share %)
                            </option>
                            {partners.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name} ({p.sharePercentage}% Share)
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 4. Purpose / Description */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            aria-label={`Purpose row ${index + 1}`}
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'description', e.target.value)
                            }
                            placeholder="e.g. Working Capital, Emergency Reserve"
                            className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* 5. Inflow Amount - with commas */}
                        <td className="py-1.5 px-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs pointer-events-none">
                              ₱
                            </span>
                            <FormattedAmountInput
                              aria-label={`Inflow Amount row ${index + 1}`}
                              value={item.inflow}
                              onChange={(val) => handleUpdateItem(item.id, 'inflow', val)}
                              placeholder="0.00"
                              className="w-full bg-neutral-950/60 border border-neutral-800 rounded pl-6 pr-2 py-1 text-xs font-mono font-semibold text-right text-cyan-300 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </td>

                        {/* 6. Owner Percentage Share Display */}
                        <td className="py-1.5 px-2">
                          {isSplitAll ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {partners.map((p) => {
                                const pShare = (amt * (p.sharePercentage || 0)) / totalShares;
                                return (
                                  <span
                                    key={p.id}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-950/90 border border-neutral-800 text-[10px] text-neutral-300"
                                    title={`${p.name} (${p.sharePercentage}%): ${formatPHP(pShare)}`}
                                  >
                                    <span className="text-neutral-400 font-medium">{p.name}:</span>
                                    <span className="text-cyan-400 font-mono text-[10px] font-bold">
                                      {p.sharePercentage}%
                                    </span>
                                    <span className="font-mono-numbers font-semibold text-cyan-300">
                                      ({formatPHP(pShare)})
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            (() => {
                              const matchedPartner = partners.find(
                                (p) => p.name.toLowerCase() === paidBy.toLowerCase()
                              );
                              if (matchedPartner) {
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/70 text-xs text-cyan-300 font-medium">
                                      <span className="font-semibold text-neutral-100">
                                        {matchedPartner.name}
                                      </span>
                                      <span className="text-[11px] font-mono font-bold text-cyan-400">
                                        ({matchedPartner.sharePercentage}% Share)
                                      </span>
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300">
                                  {item.paidBy}
                                </span>
                              );
                            })()
                          )}
                        </td>

                        {/* 7. Receipt / Ref # with Proof Attachment */}
                        <td className="py-1.5 px-2">
                          <ReceiptCell
                            ariaLabel={`Receipt Ref row ${index + 1}`}
                            receiptNo={item.receiptNo || ''}
                            attachments={item.attachments}
                            receiptImage={item.receiptImage}
                            receiptImageName={item.receiptImageName}
                            description={item.description}
                            date={item.date}
                            amount={item.inflow}
                            isIncome={true}
                            category={item.category}
                            onUpdateReceipt={(newNo, newAtts) =>
                              handleUpdateReceipt(item.id, newNo, newAtts)
                            }
                            size="xs"
                          />
                        </td>

                        {/* 8. Notes */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            aria-label={`Notes row ${index + 1}`}
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'notes', e.target.value)}
                            placeholder="Bank memo, deposit notes..."
                            className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                          />
                        </td>

                        {/* 9. Actions */}
                        <td className="py-1.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-neutral-500 hover:text-rose-400 p-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Total Footer */}
              {preFundingItems.length > 0 && (
                <tfoot>
                  <tr className="bg-neutral-950 text-neutral-200 font-semibold border-t-2 border-neutral-800 text-xs">
                    <td colSpan={4} className="py-2 px-3 text-right text-[11px] text-neutral-400 uppercase tracking-wider">
                      Total Injected Pre-Funding for {monthName}:
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono-numbers text-cyan-400 text-sm">
                      {formatPHP(totalPreFunding)}
                    </td>
                    <td colSpan={4} className="py-2 px-2 text-[11px] text-neutral-400 font-normal">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Owner shares:</span>
                        {partners.map((p) => {
                          const target = (totalPreFunding * (p.sharePercentage || 0)) / totalShares;
                          return (
                            <span key={p.id} className="text-neutral-300 font-mono">
                              {p.name}: {formatPHP(target)} ({p.sharePercentage}%)
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* Quick Split Modal */}
      {isSplitModalOpen && (
        <div
          id="quick-split-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsSplitModalOpen(false)}
        >
          <div
            id="quick-split-modal-card"
            className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-neutral-950/70 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Split className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-100">
                    Split Capital Pre-Funding by Owner Equity
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Pre-funds are split by shareholders depending on their share percentage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Total Pre-Funding Amount to Inject (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">
                    ₱
                  </span>
                  <FormattedAmountInput
                    value={splitTotalAmount}
                    onChange={(val) => setSplitTotalAmount(val)}
                    placeholder="50,000"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Injection Date</label>
                  <input
                    type="date"
                    value={splitDate}
                    onChange={(e) => setSplitDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Row Creation Style</label>
                  <select
                    value={splitCreationMode}
                    onChange={(e) => setSplitCreationMode(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="individual">Separate row per owner (best for receipts)</option>
                    <option value="consolidated">Single consolidated split row</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Purpose / Note</label>
                <input
                  type="text"
                  value={splitDescription}
                  onChange={(e) => setSplitDescription(e.target.value)}
                  placeholder="e.g. Owner Working Capital Pre-Funding"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Real-time Breakdown Preview */}
              <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
                <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Calculated Shareholder Split ({totalShares}%):
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {formatPHP(parseAmount(splitTotalAmount))} Total
                  </span>
                </div>

                <div className="space-y-1.5">
                  {partners.map((p) => {
                    const share =
                      (parseAmount(splitTotalAmount) * (p.sharePercentage || 0)) / totalShares;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-neutral-900/90 border border-neutral-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-200">{p.name}</span>
                          <span className="text-[10px] text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded font-mono font-semibold">
                            {p.sharePercentage}% Share
                          </span>
                        </div>
                        <span className="font-mono-numbers font-semibold text-cyan-300">
                          {formatPHP(share)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-neutral-950/70 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-split-injection-btn"
                type="button"
                onClick={handleConfirmSplitInjection}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
              >
                Generate Pre-Funding Injections
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

