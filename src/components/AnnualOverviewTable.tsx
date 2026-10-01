import React, { useState } from 'react';
import { MonthData, MonthCalculations, Partner } from '../types';
import { formatPHP } from '../utils/formatters';
import { getPartnerShareRatio } from '../utils/calculations';
import { ArrowUpRight, CalendarCheck, Users, Settings2, Wallet, DollarSign } from 'lucide-react';

interface AnnualOverviewTableProps {
  year: number;
  months: MonthData[];
  calculations: Record<string, MonthCalculations>;
  onSelectMonth: (monthId: string) => void;
  partners?: Partner[];
  onOpenPartnersModal?: () => void;
}

export const AnnualOverviewTable: React.FC<AnnualOverviewTableProps> = ({
  year,
  months,
  calculations,
  onSelectMonth,
  partners = [],
  onOpenPartnersModal,
}) => {
  // Toggle between Cash Balance Equity split and Monthly Net P&L split in the partner columns
  const [partnerViewMode, setPartnerViewMode] = useState<'equity' | 'pnl'>('equity');

  let annualGross = 0;
  let annualFees = 0;
  let annualDiscounts = 0;
  let annualOperatingRevenue = 0;
  let annualPreFunding = 0;
  let annualIncome = 0;
  let annualExpenses = 0;
  let annualNetProfit = 0;

  months.forEach((m) => {
    const calc = calculations[m.id];
    if (calc) {
      annualGross += calc.totalBookingsGross || 0;
      annualFees += calc.totalBookingsFees || 0;
      annualDiscounts += calc.totalBookingsDiscounts || 0;
      annualPreFunding += calc.totalPreFunding || 0;
      const opRev = calc.totalOperatingRevenue ?? ((calc.totalBookingsNet || 0) + (calc.totalOtherIncome || 0));
      annualOperatingRevenue += opRev;
      annualIncome += calc.totalNetIncome || 0;
      annualExpenses += calc.totalExpenses || 0;
      annualNetProfit += calc.netProfit || 0;
    }
  });

  const finalEndingBalance =
    calculations['dec']?.endingBalance ??
    calculations[months[months.length - 1]?.id]?.endingBalance ??
    0;
  const initialCapital = calculations['jan']?.beginningBalance ?? 0;

  return (
    <div id="annual-overview-container" className="space-y-4">
      {/* Top Unified Dashboard: Annual Operations & Partner Equity Shares */}
      <div id="annual-operations-summary" className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
              {year} Annual Operations & Partner Equity Summary
            </h2>
          </div>
          {partners.length > 0 && onOpenPartnersModal && (
            <button
              id="edit-partners-btn"
              type="button"
              onClick={onOpenPartnersModal}
              className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-emerald-400 font-medium transition-colors cursor-pointer"
              title="Edit partner names and equity percentages"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Edit Partners & Shares</span>
            </button>
          )}
        </div>

        {/* Unified Cards in One Line: Financial Operations + Partner Allocations */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr gap-2.5">
          {/* 1. Total Gross Inflows */}
          <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
            <div>
              <div className="text-[11px] text-emerald-400 mb-0.5 font-medium truncate">Annual Total Inflow</div>
              <div className="text-sm sm:text-base font-semibold font-mono-numbers text-emerald-400 truncate">
                {formatPHP(annualIncome)}
              </div>
            </div>
            <div
              className="text-[10px] text-neutral-500 font-mono truncate mt-1"
              title={`${formatPHP(annualOperatingRevenue)} bookings & rental revenue + ${formatPHP(annualPreFunding)} partner pre-funding`}
            >
              {formatPHP(annualOperatingRevenue)} rev + {formatPHP(annualPreFunding)} pre-fund
            </div>
          </div>

          {/* 2. Total Expenses */}
          <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2.5 flex flex-col justify-between min-w-0">
            <div>
              <div className="text-[11px] text-rose-400 mb-0.5 font-medium truncate">Annual Expenses</div>
              <div className="text-sm sm:text-base font-semibold font-mono-numbers text-rose-400 truncate">
                {formatPHP(annualExpenses)}
              </div>
            </div>
            <div
              className="text-[10px] text-neutral-500 font-mono truncate mt-1"
              title="12 Months Operating & Repair Expenses"
            >
              12 mos operating & repairs
            </div>
          </div>

          {/* 3. Annual Net P&L */}
          <div
            className={`border rounded-lg p-2.5 flex flex-col justify-between min-w-0 ${
              annualNetProfit > 0
                ? 'bg-emerald-950/20 border-emerald-800/40'
                : annualNetProfit < 0
                ? 'bg-rose-950/20 border-rose-800/40'
                : 'bg-neutral-950/80 border-neutral-800/80'
            }`}
          >
            <div>
              <div className="text-[11px] text-neutral-300 mb-0.5 font-medium truncate">Annual Net P&L</div>
              <div
                className={`text-sm sm:text-base font-semibold font-mono-numbers truncate ${
                  annualNetProfit > 0
                    ? 'text-emerald-400'
                    : annualNetProfit < 0
                    ? 'text-rose-400'
                    : 'text-neutral-200'
                }`}
              >
                {formatPHP(annualNetProfit)}
              </div>
            </div>
            <div
              className="text-[10px] text-neutral-500 font-mono truncate mt-1"
              title={`${formatPHP(annualIncome)} total inflow − ${formatPHP(annualExpenses)} expenses`}
            >
              {formatPHP(annualIncome)} in − {formatPHP(annualExpenses)} exp
            </div>
          </div>

          {/* 4. Total Cash Balance */}
          <div
            className={`border rounded-lg p-2.5 flex flex-col justify-between min-w-0 ${
              finalEndingBalance > 0
                ? 'bg-sky-950/20 border-sky-800/40'
                : finalEndingBalance < 0
                ? 'bg-rose-950/20 border-rose-800/40'
                : 'bg-neutral-950/80 border-neutral-800/80'
            }`}
          >
            <div>
              <div className="text-[11px] text-sky-300 mb-0.5 font-medium truncate">Total Cash Balance</div>
              <div
                className={`text-sm sm:text-base font-semibold font-mono-numbers truncate ${
                  finalEndingBalance >= 0 ? 'text-sky-300' : 'text-rose-400'
                }`}
              >
                {formatPHP(finalEndingBalance)}
              </div>
            </div>
            <div
              className="text-[10px] text-neutral-500 font-mono truncate mt-1"
              title={`${formatPHP(initialCapital)} initial capital + ${formatPHP(annualNetProfit)} net P&L`}
            >
              {formatPHP(initialCapital)} init + P&L
            </div>
          </div>

          {/* Partner Equity Share Cards */}
          {partners.map((partner, index) => {
            const shareRatio = getPartnerShareRatio(partner, partners);
            const partnerCashShare = finalEndingBalance * shareRatio;
            const partnerAnnualPayout = annualNetProfit * shareRatio;
            const partnerAvgMonthly = partnerAnnualPayout / 12;

            const dotColors = [
              'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
              'border-sky-500/40 bg-sky-950/20 text-sky-300',
              'border-amber-500/40 bg-amber-950/20 text-amber-300',
              'border-indigo-500/40 bg-indigo-950/20 text-indigo-300',
              'border-purple-500/40 bg-purple-950/20 text-purple-300',
              'border-teal-500/40 bg-teal-950/20 text-teal-300',
            ];
            const cardStyle = dotColors[index % dotColors.length];

            return (
              <div
                key={partner.id}
                className={`border rounded-lg p-2.5 flex flex-col justify-between min-w-0 ${cardStyle}`}
              >
                <div className="flex items-center justify-between text-neutral-300 mb-1 gap-1">
                  <span className="font-medium truncate text-xs">{partner.name}</span>
                  <span className="font-mono text-[10px] bg-neutral-900/80 border border-neutral-700/60 px-1.5 py-0.5 rounded text-neutral-300 shrink-0">
                    {partner.sharePercentage}%
                  </span>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider truncate">
                    Cash Balance Equity
                  </div>
                  <div
                    className={`text-sm sm:text-base font-semibold font-mono-numbers truncate ${
                      partnerCashShare >= 0 ? 'text-sky-300' : 'text-rose-400'
                    }`}
                    title={`Partner's ${partner.sharePercentage}% equity share of Total Cash Balance`}
                  >
                    {formatPHP(partnerCashShare)}
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-neutral-400 font-mono-numbers truncate" title="Partner Annual Net P&L Share">
                  P&L: <span className={partnerAnnualPayout >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatPHP(partnerAnnualPayout)}</span> (Avg: {formatPHP(partnerAvgMonthly)}/mo)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Unified Annual Overview Table */}
      <div id="annual-monthly-ledger-table" className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
        <div className="flex flex-wrap items-center justify-between px-3 py-2.5 bg-neutral-950 border-b border-neutral-800 text-xs gap-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
              {year} Monthly Ledger, Pre-Funding & Partner Equity Breakdown
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle for Partner Columns */}
            <div className="inline-flex items-center bg-neutral-900 border border-neutral-800 rounded-md p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setPartnerViewMode('equity')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  partnerViewMode === 'equity'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="Display partner share of Total Cash Balance (Equity)"
              >
                <Wallet className="w-2.5 h-2.5" />
                <span>Cash Equity Split</span>
              </button>
              <button
                type="button"
                onClick={() => setPartnerViewMode('pnl')}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  partnerViewMode === 'pnl'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
                title="Display partner share of Monthly Net P&L"
              >
                <DollarSign className="w-2.5 h-2.5" />
                <span>Net P&L Split</span>
              </button>
            </div>

            <span className="text-[10px] text-neutral-500 hidden sm:inline">
              Ending Cash Balance carries forward monthly
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-950/90 text-neutral-400 border-b border-neutral-800 text-[11px] font-medium select-none">
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-3 text-right text-cyan-400">Pre-Funding (₱)</th>
                <th className="py-2.5 px-3 text-right text-emerald-400/90">Revenue Inflow (₱)</th>
                <th className="py-2.5 px-3 text-right text-emerald-400 font-semibold">Total Inflow (₱)</th>
                <th className="py-2.5 px-3 text-right text-rose-400">Expenses (₱)</th>
                <th className="py-2.5 px-3 text-right text-neutral-200">Monthly Net P&L (₱)</th>
                <th className="py-2.5 px-3 text-right text-sky-300 font-semibold">Total Cash Balance (₱)</th>
                {partners.map((partner) => (
                  <th
                    key={partner.id}
                    className="py-2.5 px-3 text-right text-emerald-300/90 whitespace-nowrap"
                  >
                    <div>{partner.name} ({partner.sharePercentage}%)</div>
                    <div className="text-[9px] font-normal text-neutral-500">
                      {partnerViewMode === 'equity' ? 'Cash Equity' : 'P&L Share'}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {months.map((m) => {
                const calc = calculations[m.id];
                const hasData = (m.bookings?.length || 0) > 0 || (m.ledger?.length || 0) > 0;
                const isProfit = (calc?.netProfit || 0) > 0;
                const isLoss = (calc?.netProfit || 0) < 0;
                const mPreFunding = calc?.totalPreFunding || 0;
                const mOperatingRevenue = calc?.totalOperatingRevenue ?? ((calc?.totalBookingsNet || 0) + (calc?.totalOtherIncome || 0));
                const mTotalInflow = calc?.totalNetIncome || 0;
                const mExpenses = calc?.totalExpenses || 0;
                const mNetProfit = calc?.netProfit || 0;
                const mEndingBalance = calc?.endingBalance || 0;

                return (
                  <tr
                    key={m.id}
                    onClick={() => onSelectMonth(m.id)}
                    className="hover:bg-neutral-850/60 transition-colors cursor-pointer group text-neutral-200"
                  >
                    {/* Month Name */}
                    <td className="py-2 px-3 font-medium text-neutral-200 flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasData ? 'bg-emerald-400' : 'bg-neutral-700'
                        }`}
                      ></span>
                      <span>{m.name}</span>
                    </td>

                    {/* Pre-Funding */}
                    <td className="py-2 px-3 text-right font-mono-numbers">
                      {mPreFunding > 0 ? (
                        <span className="text-cyan-400 font-medium">
                          {formatPHP(mPreFunding)}
                        </span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>

                    {/* Revenue Inflow (Bookings + Rentals) */}
                    <td className="py-2 px-3 text-right font-mono-numbers text-emerald-400/90">
                      {mOperatingRevenue > 0 ? formatPHP(mOperatingRevenue) : <span className="text-neutral-500">—</span>}
                    </td>

                    {/* Total Inflow (Pre-Funding + Revenue) */}
                    <td className="py-2 px-3 text-right font-mono-numbers font-medium text-emerald-400">
                      {formatPHP(mTotalInflow)}
                    </td>

                    {/* Expenses */}
                    <td className="py-2 px-3 text-right font-mono-numbers text-rose-400">
                      {mExpenses > 0 ? formatPHP(mExpenses) : <span className="text-neutral-500">—</span>}
                    </td>

                    {/* Monthly Net Profit */}
                    <td
                      className={`py-2 px-3 text-right font-mono-numbers font-medium ${
                        isProfit
                          ? 'text-emerald-400'
                          : isLoss
                          ? 'text-rose-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {formatPHP(mNetProfit)}
                    </td>

                    {/* Ending Balance (Carried over Total Cash Balance) */}
                    <td className="py-2 px-3 text-right font-mono-numbers font-semibold text-sky-300">
                      {formatPHP(mEndingBalance)}
                    </td>

                    {/* Partner Splits */}
                    {partners.map((partner) => {
                      const shareRatio = getPartnerShareRatio(partner, partners);
                      const partnerCashShare = mEndingBalance * shareRatio;
                      const partnerPnLShare = mNetProfit * shareRatio;

                      const primaryVal = partnerViewMode === 'equity' ? partnerCashShare : partnerPnLShare;
                      const secondaryVal = partnerViewMode === 'equity' ? partnerPnLShare : partnerCashShare;

                      return (
                        <td
                          key={partner.id}
                          className="py-2 px-3 text-right font-mono-numbers"
                        >
                          <div
                            className={`font-medium ${
                              partnerViewMode === 'equity'
                                ? primaryVal >= 0
                                  ? 'text-sky-300'
                                  : 'text-rose-400'
                                : primaryVal > 0
                                ? 'text-emerald-400'
                                : primaryVal < 0
                                ? 'text-rose-400'
                                : 'text-neutral-400'
                            }`}
                          >
                            {formatPHP(primaryVal)}
                          </div>
                          <div
                            className="text-[9px] text-neutral-500 font-mono"
                            title={
                              partnerViewMode === 'equity'
                                ? `Monthly P&L Share: ${formatPHP(secondaryVal)}`
                                : `Cash Balance Share: ${formatPHP(secondaryVal)}`
                            }
                          >
                            {partnerViewMode === 'equity' ? (
                              <span className={secondaryVal > 0 ? 'text-emerald-400/80' : secondaryVal < 0 ? 'text-rose-400/80' : 'text-neutral-500'}>
                                P&L: {formatPHP(secondaryVal)}
                              </span>
                            ) : (
                              <span className="text-sky-400/80">
                                Cash: {formatPHP(secondaryVal)}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Jump arrow */}
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center text-neutral-500 group-hover:text-emerald-400 text-[11px] gap-0.5 transition-colors whitespace-nowrap">
                        Open <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Grand Annual Totals */}
            <tfoot>
              <tr className="bg-neutral-950 font-semibold text-neutral-100 border-t-2 border-neutral-800 text-xs">
                <td className="py-2.5 px-3 uppercase tracking-wider text-[11px] text-neutral-400">
                  Annual Totals ({year})
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-cyan-400">
                  {formatPHP(annualPreFunding)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-emerald-400/90">
                  {formatPHP(annualOperatingRevenue)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers font-semibold text-emerald-400">
                  {formatPHP(annualIncome)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-rose-400">
                  {formatPHP(annualExpenses)}
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-mono-numbers font-semibold ${
                    annualNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatPHP(annualNetProfit)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-sky-300">
                  Final: {formatPHP(finalEndingBalance)}
                </td>
                {partners.map((partner) => {
                  const shareRatio = getPartnerShareRatio(partner, partners);
                  const totalPartnerCashShare = finalEndingBalance * shareRatio;
                  const totalPartnerPnLShare = annualNetProfit * shareRatio;

                  const primaryVal = partnerViewMode === 'equity' ? totalPartnerCashShare : totalPartnerPnLShare;
                  const secondaryVal = partnerViewMode === 'equity' ? totalPartnerPnLShare : totalPartnerCashShare;

                  return (
                    <td
                      key={partner.id}
                      className="py-2.5 px-3 text-right font-mono-numbers font-semibold"
                    >
                      <div
                        className={
                          partnerViewMode === 'equity'
                            ? primaryVal >= 0
                              ? 'text-sky-300'
                              : 'text-rose-400'
                            : primaryVal >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {formatPHP(primaryVal)}
                      </div>
                      <div className="text-[9px] font-normal font-mono">
                        {partnerViewMode === 'equity' ? (
                          <span className={secondaryVal >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}>
                            P&L: {formatPHP(secondaryVal)}
                          </span>
                        ) : (
                          <span className="text-sky-400/80">
                            Cash: {formatPHP(secondaryVal)}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
