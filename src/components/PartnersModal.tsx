import React, { useState } from 'react';
import { Partner } from '../types';
import { generateId, formatPHP } from '../utils/formatters';
import { Users, Plus, Trash2, Scale, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface PartnersModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: Partner[];
  onSavePartners: (partners: Partner[]) => void;
  currentNetProfit: number;
  annualNetProfit: number;
  activeMonthName: string;
}

export const PartnersModal: React.FC<PartnersModalProps> = ({
  isOpen,
  onClose,
  partners,
  onSavePartners,
  currentNetProfit,
  annualNetProfit,
  activeMonthName,
}) => {
  const [localPartners, setLocalPartners] = useState<Partner[]>(() => {
    return partners && partners.length > 0
      ? partners
      : [
          { id: 'p-1', name: 'Partner 1', sharePercentage: 50 },
          { id: 'p-2', name: 'Partner 2', sharePercentage: 50 },
        ];
  });

  const [previewMode, setPreviewMode] = useState<'month' | 'year'>('month');

  if (!isOpen) return null;

  const totalShare = localPartners.reduce(
    (acc, p) => acc + (Number(p.sharePercentage) || 0),
    0
  );
  const roundedTotal = Math.round(totalShare * 100) / 100;
  const isExact100 = Math.abs(roundedTotal - 100) < 0.01;
  const isOver100 = roundedTotal > 100;
  const isUnder100 = roundedTotal < 100;

  const handleNameChange = (id: string, name: string) => {
    setLocalPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
  };

  const handleShareChange = (id: string, valStr: string) => {
    const val = parseFloat(valStr);
    setLocalPartners((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, sharePercentage: isNaN(val) ? 0 : Math.max(0, val) }
          : p
      )
    );
  };

  const handleAddPartner = () => {
    const remaining = Math.max(0, Math.round((100 - roundedTotal) * 100) / 100);
    const newPartner: Partner = {
      id: generateId(),
      name: `Partner ${localPartners.length + 1}`,
      sharePercentage: remaining > 0 ? remaining : 0,
    };
    setLocalPartners((prev) => [...prev, newPartner]);
  };

  const handleRemovePartner = (id: string) => {
    if (localPartners.length <= 1) return;
    setLocalPartners((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSplitEvenly = () => {
    const count = localPartners.length;
    if (count === 0) return;
    const base = Math.floor((100 / count) * 100) / 100;
    const remainder = Math.round((100 - base * count) * 100) / 100;

    setLocalPartners((prev) =>
      prev.map((p, idx) => ({
        ...p,
        // Give the remainder rounding penny to the first partner
        sharePercentage: idx === 0 ? Math.round((base + remainder) * 100) / 100 : base,
      }))
    );
  };

  const handleSave = () => {
    onSavePartners(localPartners);
    onClose();
  };

  const currentReferenceProfit = previewMode === 'month' ? currentNetProfit : annualNetProfit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Partners & Equity Shares
              </h2>
              <p className="text-[11px] text-neutral-400">
                Manage co-hosts, investors, and profit-sharing allocations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddPartner}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700/60 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Partner</span>
              </button>

              <button
                type="button"
                onClick={handleSplitEvenly}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-xs font-medium transition-colors cursor-pointer"
                title="Split 100% equity evenly among all partners"
              >
                <Scale className="w-3.5 h-3.5 text-neutral-400" />
                <span>Split Evenly</span>
              </button>
            </div>

            {/* Total Share Status */}
            <div className="flex items-center gap-1.5">
              {isExact100 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Total: {roundedTotal.toFixed(1)}% (100% Balanced)
                </span>
              ) : isOver100 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Total: {roundedTotal.toFixed(1)}% (+{(roundedTotal - 100).toFixed(1)}% Over)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Total: {roundedTotal.toFixed(1)}% ({(100 - roundedTotal).toFixed(1)}% unallocated)
                </span>
              )}
            </div>
          </div>

          {/* Allocation Progress Bar */}
          <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800 flex">
            {localPartners.map((partner, idx) => {
              const colors = [
                'bg-emerald-500',
                'bg-sky-500',
                'bg-amber-500',
                'bg-indigo-500',
                'bg-purple-500',
                'bg-teal-500',
              ];
              const color = colors[idx % colors.length];
              const share = Math.max(0, partner.sharePercentage || 0);
              return (
                <div
                  key={partner.id}
                  style={{ width: `${Math.min(100, share)}%` }}
                  className={`${color} h-full transition-all duration-300`}
                  title={`${partner.name}: ${share}%`}
                />
              );
            })}
          </div>

          {/* Partners Table / List */}
          <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950/40">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-neutral-950 border-b border-neutral-800 text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              <div className="col-span-5 sm:col-span-6">Partner Name</div>
              <div className="col-span-3 sm:col-span-3 text-right">Share (%)</div>
              <div className="col-span-3 sm:col-span-2 text-right">Preview Split</div>
              <div className="col-span-1 text-center"></div>
            </div>

            <div className="divide-y divide-neutral-800/70">
              {localPartners.map((partner, index) => {
                const colors = [
                  'border-l-emerald-500 text-emerald-400',
                  'border-l-sky-500 text-sky-400',
                  'border-l-amber-500 text-amber-400',
                  'border-l-indigo-500 text-indigo-400',
                  'border-l-purple-500 text-purple-400',
                  'border-l-teal-500 text-teal-400',
                ];
                const badgeColor = colors[index % colors.length];
                const splitAmount = (currentReferenceProfit * (partner.sharePercentage || 0)) / 100;

                return (
                  <div
                    key={partner.id}
                    className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-neutral-900/50 transition-colors"
                  >
                    {/* Partner Name */}
                    <div className="col-span-5 sm:col-span-6 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full border-2 ${badgeColor.split(' ')[0]} bg-neutral-900 shrink-0`} />
                      <input
                        type="text"
                        value={partner.name}
                        onChange={(e) => handleNameChange(partner.id, e.target.value)}
                        placeholder="e.g. Partner Name"
                        className="w-full bg-neutral-900 border border-neutral-700/80 rounded px-2.5 py-1 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Share Percentage */}
                    <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={partner.sharePercentage === 0 ? '' : partner.sharePercentage}
                        onChange={(e) => handleShareChange(partner.id, e.target.value)}
                        placeholder="0"
                        className="w-18 bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-right text-neutral-100 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-neutral-400 font-medium">%</span>
                    </div>

                    {/* Preview Amount */}
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <div
                        className={`text-xs font-mono-numbers font-medium truncate ${
                          splitAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                        title={formatPHP(splitAmount)}
                      >
                        {formatPHP(splitAmount)}
                      </div>
                    </div>

                    {/* Remove Action */}
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePartner(partner.id)}
                        disabled={localPartners.length <= 1}
                        className="p-1 text-neutral-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-neutral-500 transition-colors"
                        title={localPartners.length <= 1 ? 'Minimum 1 partner required' : 'Remove partner'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview context banner */}
          <div className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-neutral-400">
              Live Split Preview based on:{' '}
              <span className="text-neutral-200 font-medium">
                {previewMode === 'month' ? `${activeMonthName} Net Profit` : 'Annual Net Profit'}
              </span>{' '}
              ({formatPHP(currentReferenceProfit)})
            </div>

            <div className="inline-flex rounded border border-neutral-800 p-0.5 bg-neutral-900 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewMode('month')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  previewMode === 'month'
                    ? 'bg-neutral-800 text-neutral-100 font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {activeMonthName}
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('year')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  previewMode === 'year'
                    ? 'bg-neutral-800 text-neutral-100 font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Full Year
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/90 flex items-center justify-between gap-2">
          <div className="text-[11px] text-neutral-400">
            {isExact100 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready to distribute
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Shares do not equal 100%
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-semibold text-xs transition-colors"
            >
              Save Partners & Shares
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
