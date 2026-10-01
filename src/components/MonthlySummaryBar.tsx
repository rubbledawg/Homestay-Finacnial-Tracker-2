import React from 'react';
import { MonthCalculations, Partner } from '../types';
import { formatPHP } from '../utils/formatters';
import { getPartnerShareRatio } from '../utils/calculations';
import { FormattedAmountInput } from './FormattedAmountInput';
import { ArrowUpRight, TrendingDown, TrendingUp, DollarSign, Wallet, Users, Settings2 } from 'lucide-react';

interface MonthlySummaryBarProps {
  monthName: string;
  prevMonthName?: string;
  nextMonthName?: string;
  calculations: MonthCalculations;
  isFirstMonth?: boolean;
  initialBalanceOverride?: number;
  onUpdateInitialBalance?: (val: number) => void;
  onAddPreFunding?: () => void;
  partners?: Partner[];
  onOpenPartnersModal?: () => void;
}

export const MonthlySummaryBar: React.FC<MonthlySummaryBarProps> = ({
  monthName,
  prevMonthName,
  nextMonthName,
  calculations,
  isFirstMonth,
  initialBalanceOverride,
  onUpdateInitialBalance,
  onAddPreFunding,
  partners = [],
  onOpenPartnersModal,
}) => {
  const isMonthlyProfit = calculations.monthlyNetProfit > 0;
  const isMonthlyLoss = calculations.monthlyNetProfit < 0;

  return (
    <div id="monthly-summary-bar" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs mb-3">
      {/* Top micro header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-neutral-800/80 text-neutral-400">
        <div className="flex items-center gap-1.5 font-medium text-neutral-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          <span>{monthName} Financial Summary</span>
          <span className="text-neutral-500 font-normal">| Philippine Pesos (₱)</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          {isFirstMonth ? (
            <div className="flex items-center gap-1 text-neutral-400">
              <span>Starting Capital:</span>
              <div className="relative inline-flex items-center">
                <span className="absolute left-1.5 text-neutral-500 font-mono text-[11px] pointer-events-none z-10">₱</span>
                <FormattedAmountInput
                  id="jan-initial-balance-input"
                  aria-label="January Starting Capital"
                  value={initialBalanceOverride ?? 0}
                  onChange={(val) => onUpdateInitialBalance?.(val === '' ? 0 : val)}
                  className="w-28 pl-5 pr-1.5 py-0.5 bg-neutral-950 border border-neutral-700 rounded text-neutral-200 font-mono-numbers text-[11px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          ) : (
            <div className="text-neutral-400 flex items-center gap-1">
              <span>Source:</span>
              <span className="text-neutral-300 font-medium">{prevMonthName} Carryover</span>
            </div>
          )}
          {calculations.totalDiscounts > 0 && (
            <div
              className="text-neutral-400 flex items-center gap-1.5 font-mono text-[10px] bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 whitespace-nowrap"
              title={`Discounts Breakdown: Shareholders ₱${(calculations.totalShareholderDiscounts || 0).toLocaleString()} (repayable) | Platform/Airbnb ₱${(calculations.totalPlatformDiscounts || 0).toLocaleString()}`}
            >
              <span className="text-neutral-400 font-semibold">Discounts:</span>
              <span className="text-neutral-200 font-bold">{formatPHP(calculations.totalDiscounts)}</span>
              <span className="text-neutral-500 font-normal">(</span>
              {calculations.totalShareholderDiscounts > 0 && (
                <span className="text-amber-400 font-semibold text-[9px]">
                  Sh: {formatPHP(calculations.totalShareholderDiscounts)}
                </span>
              )}
              {calculations.totalShareholderDiscounts > 0 && (calculations.totalPlatformDiscounts || 0) > 0 && (
                <span className="text-neutral-600 text-[9px]">|</span>
              )}
              {(calculations.totalPlatformDiscounts || 0) > 0 && (
                <span className="text-sky-400 font-semibold text-[9px]">
                  OTA: {formatPHP(calculations.totalPlatformDiscounts || 0)}
                </span>
              )}
              <span className="text-neutral-500 font-normal">)</span>
            </div>
          )}
          <div className="text-neutral-400">
            Margin: <span className="font-mono-numbers text-neutral-200 font-medium">{calculations.profitMargin.toFixed(1)}%</span>
          </div>
          <div className="text-neutral-400 flex items-center gap-1">
            <span>Total Cash Balance:</span>
            <span
              className={`font-mono-numbers font-semibold ${
                calculations.endingBalance > 0
                  ? 'text-sky-300'
                  : calculations.endingBalance < 0
                  ? 'text-rose-400'
                  : 'text-neutral-300'
              }`}
            >
              {formatPHP(calculations.endingBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Pipeline: [Beg. Cash] ➔ [Inflows] ➔ [Outflows] ➔ [Net P&L] ➔ [Ending Balance] ➔ [Partner Split] */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* 1. Beg. Cash */}
        <div className="bg-neutral-950/70 border border-neutral-800/90 rounded p-2.5 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center justify-between text-neutral-400 mb-0.5">
            <span className="truncate font-medium text-[11px]" title="Beg. Cash: Starting balance carried forward into this month">
              Beg. Cash
            </span>
            <Wallet className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          </div>
          <div className={`text-base font-semibold font-mono-numbers truncate ${
            calculations.beginningBalance < 0 ? 'text-red-400' : 'text-neutral-100'
          }`}>
            {calculations.beginningBalance < 0 ? `-${formatPHP(Math.abs(calculations.beginningBalance))}` : formatPHP(calculations.beginningBalance)}
          </div>
          <div className="text-[10px] text-cyan-400/90 font-mono truncate" title={isFirstMonth ? 'Initial Starting Capital' : `Carried over from ${prevMonthName}`}>
            {isFirstMonth ? 'initial capital' : `from ${prevMonthName || 'prev'}`}
          </div>
        </div>

        {/* 2. Inflows (+ incoming revenue & injections) */}
        <div className="bg-neutral-950/70 border border-emerald-900/40 rounded p-2.5 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center justify-between text-emerald-400/90 mb-0.5">
            <span className="truncate font-medium text-[11px]" title={`${monthName} Inflows: All incoming booking payouts and partner capital injections`}>
              {monthName} Inflows
            </span>
            <div className="flex items-center gap-1">
              {onAddPreFunding && (
                <button
                  type="button"
                  onClick={onAddPreFunding}
                  className="text-[9.5px] font-medium text-cyan-400 hover:text-cyan-200 underline cursor-pointer shrink-0"
                  title="Add partner capital injection to ledger"
                >
                  + Inject
                </button>
              )}
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
          </div>
          <div className="text-base font-semibold font-mono-numbers text-emerald-400 truncate">
            {formatPHP(calculations.totalNetIncome)}
          </div>
          <div
            className="text-[10px] text-neutral-500 font-mono truncate"
            title={
              calculations.totalPreFunding > 0
                ? `${formatPHP(calculations.totalBookingsNet)} bookings + ${formatPHP(calculations.totalPreFunding)} injections`
                : `${formatPHP(calculations.totalNetIncome)} total inflows in ${monthName}`
            }
          >
            {calculations.totalPreFunding > 0
              ? `${formatPHP(calculations.totalBookingsNet)} bk + ${formatPHP(calculations.totalPreFunding)} inj`
              : 'incoming revenue'}
          </div>
        </div>

        {/* 3. Outflows (Expenses & Disbursements) */}
        <div className="bg-neutral-950/70 border border-rose-900/40 rounded p-2.5 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center justify-between text-rose-400/90 mb-0.5">
            <span className="truncate font-medium text-[11px]" title={`${monthName} Outflows: All operating expenses and disbursements`}>
              {monthName} Outflows
            </span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          </div>
          <div className="text-base font-semibold font-mono-numbers text-rose-400 truncate">
            {formatPHP(calculations.totalExpenses)}
          </div>
          <div
            className="text-[10px] text-neutral-500 font-mono truncate"
            title={
              calculations.totalReimbursables > 0
                ? `${formatPHP(calculations.totalExpenses - calculations.totalReimbursables)} operational + ${formatPHP(calculations.totalReimbursables)} reimbursable`
                : `${formatPHP(calculations.totalExpenses)} total outflows in ${monthName}`
            }
          >
            {calculations.totalReimbursables > 0
              ? `${formatPHP(calculations.totalExpenses - calculations.totalReimbursables)} op + ${formatPHP(calculations.totalReimbursables)} reimb`
              : 'total expenses'}
          </div>
        </div>

        {/* 4. Net P&L (Inflows − Outflows) */}
        <div
          className={`border rounded p-2.5 flex flex-col justify-between min-h-[92px] ${
            isMonthlyProfit
              ? 'bg-emerald-950/20 border-emerald-800/40'
              : isMonthlyLoss
              ? 'bg-rose-950/20 border-rose-800/40'
              : 'bg-neutral-950/70 border-neutral-800/90'
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span
              className={`truncate font-medium text-[11px] ${
                isMonthlyProfit ? 'text-emerald-300' : isMonthlyLoss ? 'text-rose-300' : 'text-neutral-400'
              }`}
              title={`${monthName} Net Profit / Loss = ${monthName} Inflows minus ${monthName} Outflows`}
            >
              {monthName} Net P&L
            </span>
            <DollarSign
              className={`w-3.5 h-3.5 shrink-0 ${
                isMonthlyProfit ? 'text-emerald-400' : isMonthlyLoss ? 'text-rose-400' : 'text-neutral-500'
              }`}
            />
          </div>
          <div
            className={`text-base font-bold font-mono-numbers truncate ${
              isMonthlyProfit ? 'text-emerald-400' : isMonthlyLoss ? 'text-rose-400' : 'text-neutral-200'
            }`}
          >
            {calculations.monthlyNetProfit < 0
              ? `-${formatPHP(Math.abs(calculations.monthlyNetProfit))}`
              : formatPHP(calculations.monthlyNetProfit)}
          </div>
          <div
            className="text-[10px] text-neutral-400 font-mono truncate"
            title={`${monthName} Inflows (${formatPHP(calculations.totalNetIncome)}) − ${monthName} Outflows (${formatPHP(calculations.totalExpenses)}) = ${monthName} Net P&L (Margin: ${calculations.profitMargin.toFixed(1)}%)`}
          >
            {monthName} only: {formatPHP(calculations.totalNetIncome)} in − {formatPHP(calculations.totalExpenses)} out
          </div>
        </div>

        {/* 5. Ending Balance (Beg Cash + Net P&L) */}
        <div
          className={`border rounded p-2.5 flex flex-col justify-between min-h-[92px] ${
            calculations.endingBalance >= 0
              ? 'bg-sky-950/20 border-sky-800/40'
              : 'bg-rose-950/20 border-rose-800/40'
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span
              className={`truncate font-medium text-[11px] ${
                calculations.endingBalance >= 0 ? 'text-sky-300' : 'text-rose-300'
              }`}
              title={`Total Cash Balance at close of ${monthName} = Beg. Cash + ${monthName} Net P&L`}
            >
              Ending Cash ({monthName})
            </span>
            <Wallet
              className={`w-3.5 h-3.5 shrink-0 ${
                calculations.endingBalance >= 0 ? 'text-sky-400' : 'text-rose-400'
              }`}
            />
          </div>
          <div
            className={`text-base font-bold font-mono-numbers truncate ${
              calculations.endingBalance >= 0 ? 'text-sky-300' : 'text-rose-400'
            }`}
          >
            {calculations.endingBalance < 0
              ? `-${formatPHP(Math.abs(calculations.endingBalance))}`
              : formatPHP(calculations.endingBalance)}
          </div>
          <div
            className="text-[10px] text-neutral-500 font-mono truncate"
            title={`${formatPHP(calculations.beginningBalance)} beg + (${formatPHP(calculations.monthlyNetProfit)} ${monthName} P&L)`}
          >
            Beg. Cash + {monthName} P&L
          </div>
        </div>

        {/* 6. Partner Split */}
        <div className="bg-neutral-950/70 border border-neutral-800/90 rounded p-2.5 flex flex-col justify-between min-h-[92px]">
          <div className="flex items-center justify-between text-neutral-400 mb-0.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400/90">
              <Users className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{monthName} Cash Split</span>
            </div>
            {onOpenPartnersModal && (
              <button
                type="button"
                onClick={onOpenPartnersModal}
                className="text-[10px] text-neutral-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-0.5"
                title="Edit partner names and equity shares"
              >
                <Settings2 className="w-2.5 h-2.5" />
                <span>Edit</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 my-auto">
            {partners && partners.length > 0 ? (
              partners.map((partner, index) => {
                const shareRatio = getPartnerShareRatio(partner, partners);
                const partnerShare = calculations.endingBalance * shareRatio;
                const totalPending = calculations.totalPendingReimbursements || 0;
                const partnerBalance = calculations.partnerBalances?.[partner.name];
                const partnerPaidPending = partnerBalance?.pendingAmount || 0;
                const partnerEquitySharePending = totalPending * shareRatio;
                const netReimbPosition = partnerPaidPending - partnerEquitySharePending;

                const dotColors = [
                  'bg-emerald-400',
                  'bg-sky-400',
                  'bg-amber-400',
                  'bg-indigo-400',
                  'bg-purple-400',
                  'bg-teal-400',
                ];
                const dotColor = dotColors[index % dotColors.length];

                return (
                  <div
                    key={partner.id}
                    className="flex flex-col text-[10px] leading-tight"
                  >
                    <div className="flex items-center gap-1 min-w-0 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                      <span className="text-neutral-300 truncate font-medium">{partner.name}</span>
                      <span className="text-neutral-500 font-mono text-[9px]">({partner.sharePercentage}%)</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono-numbers pl-2.5 mt-0.5">
                      <span
                        className={`font-semibold text-[11px] ${
                          partnerShare >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                        title={`Total cash balance share: ${formatPHP(partnerShare)}`}
                      >
                        {formatPHP(partnerShare)}
                      </span>
                      {netReimbPosition > 0.01 && (
                        <span
                          className="text-[9px] text-emerald-400 font-mono"
                          title={`${partner.name} is owed ${formatPHP(netReimbPosition)} by other partner(s) for out-of-pocket expenses`}
                        >
                          (+₱{Math.round(netReimbPosition).toLocaleString()})
                        </span>
                      )}
                      {netReimbPosition < -0.01 && (
                        <span
                          className="text-[9px] text-amber-400 font-mono"
                          title={`${partner.name} owes ${formatPHP(Math.abs(netReimbPosition))} to other partner(s) based on equity share`}
                        >
                          (-₱{Math.round(Math.abs(netReimbPosition)).toLocaleString()})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-[10px] text-neutral-500 italic">No partners configured</div>
            )}

            {/* Reimbursable Settlement Debt Summary between partners */}
            {calculations.totalPendingReimbursements > 0 && partners && partners.length >= 2 && (
              <div className="pt-0.5 mt-0.5 border-t border-neutral-800/80 text-[9px] text-amber-300 font-mono flex items-center justify-between">
                <span className="text-neutral-400 text-[9px]">Reimb:</span>
                <span className="truncate ml-1 font-medium text-right text-[9px]">
                  {(() => {
                    const totalPending = calculations.totalPendingReimbursements;
                    const totalShares = partners.reduce((sum, p) => sum + (p.sharePercentage || 0), 0) || 100;
                    const debtor = partners.find((p) => {
                      const paid = calculations.partnerBalances?.[p.name]?.pendingAmount || 0;
                      const liability = (totalPending * (p.sharePercentage || 0)) / totalShares;
                      return paid - liability < -0.01;
                    });
                    const creditor = partners.find((p) => {
                      const paid = calculations.partnerBalances?.[p.name]?.pendingAmount || 0;
                      const liability = (totalPending * (p.sharePercentage || 0)) / totalShares;
                      return paid - liability > 0.01;
                    });
                    if (debtor && creditor) {
                      const debtAmt =
                        (totalPending * (debtor.sharePercentage || 0)) / totalShares -
                        (calculations.partnerBalances?.[debtor.name]?.pendingAmount || 0);
                      return `${debtor.name} owes ${creditor.name} ${formatPHP(debtAmt)}`;
                    }
                    return `Pending: ${formatPHP(totalPending)}`;
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
