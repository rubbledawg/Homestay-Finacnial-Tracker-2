import React from 'react';
import { MonthData, MonthCalculations, Partner } from '../types';
import { formatPHP } from '../utils/formatters';
import { getUnifiedLedgerRows } from '../utils/export';
import { getPartnerShareRatio } from '../utils/calculations';
import {
  Wallet,
  TrendingDown,
  ArrowUpRight,
  Landmark,
  Layers,
  Tag,
  Users,
} from 'lucide-react';

interface ExportReportDocumentProps {
  year: number;
  monthsData: MonthData[];
  calculations: Record<string, MonthCalculations>;
  selectedMonthIds: string[];
  partners?: Partner[];
}

export const ExportReportDocument: React.FC<ExportReportDocumentProps> = ({
  year,
  monthsData,
  calculations,
  selectedMonthIds,
  partners = [],
}) => {
  const selectedMonths = monthsData.filter((m) => selectedMonthIds.includes(m.id));

  // Compute period aggregates including separated shareholder vs platform discounts
  const aggregate = selectedMonths.reduce(
    (acc, m) => {
      const calc = calculations[m.id];
      if (!calc) return acc;
      acc.grossInflow += calc.totalNetIncome || 0;
      acc.expenses += calc.totalExpenses || 0;
      acc.netProfit += calc.netProfit || 0;
      acc.preFunding += calc.totalPreFunding || 0;
      acc.shareholderDiscounts += calc.totalShareholderDiscounts || 0;
      acc.platformDiscounts += calc.totalPlatformDiscounts || 0;
      acc.totalDiscounts += calc.totalDiscounts || 0;
      return acc;
    },
    {
      grossInflow: 0,
      expenses: 0,
      netProfit: 0,
      preFunding: 0,
      shareholderDiscounts: 0,
      platformDiscounts: 0,
      totalDiscounts: 0,
    }
  );

  const firstSelected = selectedMonths[0];
  const lastSelected = selectedMonths[selectedMonths.length - 1];

  const firstCalc = firstSelected ? calculations[firstSelected.id] : null;
  const lastCalc = lastSelected ? calculations[lastSelected.id] : null;

  const initialStartingBalance = firstCalc ? firstCalc.beginningBalance : 0;
  const finalEndingBalance = lastCalc ? lastCalc.endingBalance : 0;

  const periodSubtitle =
    selectedMonths.length === 12
      ? `Full Year January 1 – December 31, ${year}`
      : selectedMonths.length === 1
      ? `${firstSelected?.name} 1 – ${firstSelected?.name} ${new Date(year, monthsData.indexOf(firstSelected) + 1, 0).getDate()}, ${year}`
      : `${firstSelected?.name} 1 – ${lastSelected?.name} ${new Date(year, monthsData.indexOf(lastSelected) + 1, 0).getDate()}, ${year}`;

  return (
    <div
      id="export-document-canvas"
      className="bg-white text-neutral-900 p-3 font-sans border border-neutral-300 rounded shadow-sm mx-auto space-y-2"
      style={{ width: '700px', minWidth: '700px', maxWidth: '700px', boxSizing: 'border-box' }}
    >
      {/* 1. Executive Document Title Header */}
      <div className="border-b border-neutral-200 pb-1 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-neutral-900 leading-none">
            Airbnb Financial & Operations Report
          </h1>
          <p className="text-[8.5px] text-neutral-500 font-medium mt-0.5">
            Reporting Period: <span className="text-neutral-800 font-semibold">{periodSubtitle}</span>
            <span className="mx-1 text-neutral-300">|</span>
            <span>Cash Flow, Operating Disbursements & Bookings</span>
          </p>
        </div>
        <div className="text-right text-[8px] text-neutral-400 font-mono leading-tight">
          <div>Currency: PHP (₱)</div>
          <div>All figures reconciled</div>
        </div>
      </div>

      {/* 2. Compact Period Summary Cards Ribbon */}
      <div className="bg-neutral-50 border border-neutral-200 rounded p-1.5 space-y-1">
        <div className="flex items-center justify-between text-[8.5px] font-semibold text-neutral-600 uppercase tracking-wider">
          <span className="flex items-center gap-1 text-blue-700">
            <Layers className="w-2.5 h-2.5" />
            Executive Summary ({selectedMonths.length} {selectedMonths.length === 1 ? 'Month' : 'Months'})
          </span>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[8px] font-normal">
            {aggregate.shareholderDiscounts > 0 && (
              <span className="text-amber-900 font-medium flex items-center gap-0.5 bg-amber-50 px-1 py-0.2 rounded border border-amber-300">
                <Users className="w-2 h-2 text-amber-700" />
                <span>Sh: {formatPHP(aggregate.shareholderDiscounts)}</span>
              </span>
            )}
            {aggregate.platformDiscounts > 0 && (
              <span className="text-sky-900 font-medium flex items-center gap-0.5 bg-sky-50 px-1 py-0.2 rounded border border-sky-300">
                <Tag className="w-2 h-2 text-sky-700" />
                <span>OTA: -{formatPHP(aggregate.platformDiscounts)}</span>
              </span>
            )}
            <span className="text-neutral-500 ml-0.5">
              Margin: {aggregate.grossInflow > 0 ? ((aggregate.netProfit / aggregate.grossInflow) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {/* Card 1: Starting Cash */}
          <div className="bg-white border border-neutral-200 rounded p-1 flex flex-col justify-between min-h-[42px] shadow-2xs">
            <div className="text-[7.5px] text-neutral-500 font-medium truncate">
              {firstSelected?.id === 'jan' ? 'Initial Capital' : 'Beginning Cash'}
            </div>
            <div className={`text-[9.5px] font-bold font-mono leading-tight ${
              initialStartingBalance < 0 ? 'text-red-600' : 'text-neutral-800'
            }`}>
              {initialStartingBalance < 0 ? `-${formatPHP(Math.abs(initialStartingBalance))}` : formatPHP(initialStartingBalance)}
            </div>
            <div className="text-[7px] text-neutral-400 font-mono truncate">
              Carried forward
            </div>
          </div>

          {/* Card 2: Total Gross Inflow */}
          <div className="bg-white border border-neutral-200 rounded p-1 flex flex-col justify-between min-h-[42px] shadow-2xs">
            <div className="flex items-center justify-between text-[7.5px] text-emerald-700 font-semibold truncate">
              <span>Total Inflow (COB)</span>
              <ArrowUpRight className="w-2 h-2 text-emerald-600" />
            </div>
            <div className="text-[9.5px] font-bold font-mono text-emerald-600 leading-tight">
              {formatPHP(aggregate.grossInflow)}
            </div>
            <div className="text-[7px] text-neutral-400 font-mono truncate">
              Injected & revenue
            </div>
          </div>

          {/* Card 3: Total Outflows / Disbursements */}
          <div className="bg-white border border-neutral-200 rounded p-1 flex flex-col justify-between min-h-[42px] shadow-2xs">
            <div className="flex items-center justify-between text-[7.5px] text-rose-700 font-semibold truncate">
              <span>Total Outflow</span>
              <TrendingDown className="w-2 h-2 text-rose-600" />
            </div>
            <div className="text-[9.5px] font-bold font-mono text-rose-600 leading-tight">
              {formatPHP(aggregate.expenses)}
            </div>
            <div className="text-[7px] text-neutral-400 font-mono truncate">
              Operations & expenses
            </div>
          </div>

          {/* Card 4: Net P&L */}
          <div className="bg-white border border-neutral-200 rounded p-1 flex flex-col justify-between min-h-[42px] shadow-2xs">
            <div className="flex items-center justify-between text-[7.5px] font-semibold truncate">
              <span className={aggregate.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                Period Net P&L
              </span>
              <Wallet className="w-2 h-2 text-neutral-400" />
            </div>
            <div className={`text-[9.5px] font-bold font-mono leading-tight ${
              aggregate.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {aggregate.netProfit < 0 ? `-${formatPHP(Math.abs(aggregate.netProfit))}` : formatPHP(aggregate.netProfit)}
            </div>
            <div className="text-[7px] text-neutral-400 font-mono truncate">
              Inflows − Outflows
            </div>
          </div>

          {/* Card 5: Ending Cash Balance */}
          <div className={`border rounded p-1 flex flex-col justify-between min-h-[42px] shadow-2xs ${
            finalEndingBalance < 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-blue-50/80 border-blue-200'
          }`}>
            <div className={`flex items-center justify-between text-[7.5px] font-semibold truncate ${
              finalEndingBalance < 0 ? 'text-rose-900' : 'text-blue-900'
            }`}>
              <span>Ending Cash</span>
              <Landmark className={`w-2 h-2 ${finalEndingBalance < 0 ? 'text-rose-700' : 'text-blue-700'}`} />
            </div>
            <div className={`text-[9.5px] font-bold font-mono leading-tight ${
              finalEndingBalance < 0 ? 'text-red-600' : 'text-blue-800'
            }`}>
              {finalEndingBalance < 0 ? `-${formatPHP(Math.abs(finalEndingBalance))}` : formatPHP(finalEndingBalance)}
            </div>
            <div className={`text-[7px] font-mono truncate ${finalEndingBalance < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
              {finalEndingBalance < 0 ? 'Deficit balance' : 'Remaining balance'}
            </div>
          </div>

          {/* Card 6: Partner Split (Right after Ending Cash) */}
          <div className="bg-white border border-neutral-200 rounded p-1 flex flex-col justify-between min-h-[42px] shadow-2xs">
            <div className="flex items-center justify-between text-[7.5px] font-semibold text-emerald-800 truncate">
              <span>Partner Split</span>
              <Users className="w-2 h-2 text-emerald-600 shrink-0" />
            </div>

            {partners && partners.length > 0 ? (
              <div className="space-y-0.5 my-auto">
                {partners.slice(0, 2).map((partner, pIdx) => {
                  const partnerShare = finalEndingBalance * getPartnerShareRatio(partner, partners);
                  const dotColors = ['bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-purple-500'];
                  const dotColor = dotColors[pIdx % dotColors.length];
                  return (
                    <div key={partner.id} className="flex items-center justify-between text-[7px] leading-none">
                      <div className="flex items-center gap-0.5 truncate max-w-[56px]">
                        <span className={`w-1 h-1 rounded-full ${dotColor} shrink-0`} />
                        <span className="text-neutral-700 font-medium truncate" title={partner.name}>
                          {partner.name}
                        </span>
                        <span className="text-neutral-400 font-mono text-[6px]">({partner.sharePercentage}%)</span>
                      </div>
                      <span
                        className={`font-mono font-bold text-[7.5px] whitespace-nowrap ${
                          partnerShare < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {partnerShare < 0 ? `-${formatPHP(Math.abs(partnerShare))}` : formatPHP(partnerShare)}
                      </span>
                    </div>
                  );
                })}
                {partners.length > 2 && (
                  <div className="text-[6px] text-neutral-400 font-mono truncate">
                    +{partners.length - 2} more partners
                  </div>
                )}
              </div>
            ) : (
              <div className="my-auto">
                <div className="text-[9.5px] font-bold font-mono text-neutral-500 leading-tight">
                  50% / 50%
                </div>
                <div className="text-[6.5px] text-neutral-400 font-mono truncate">Equal split</div>
              </div>
            )}

            <div className="text-[7px] text-neutral-400 font-mono truncate">
              Ending cash share
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sequential Monthly Cash Flow & Expenses Tables */}
      <div className="space-y-2.5">
        {selectedMonths.map((month, idx) => {
          const calc = calculations[month.id] || {
            beginningBalance: 0,
            totalPreFunding: 0,
            totalNetIncome: 0,
            totalExpenses: 0,
            netProfit: 0,
            endingBalance: 0,
            profitMargin: 0,
            totalDiscounts: 0,
            totalShareholderDiscounts: 0,
            totalPlatformDiscounts: 0,
          };
          const rawRows = getUnifiedLedgerRows(month, partners);

          // Build running balance chronological rows starting with beginning balance
          let currentRunningBalance = calc.beginningBalance;

          const rowsWithRunningBalance = rawRows.map((r) => {
            currentRunningBalance = currentRunningBalance + r.inflow - r.outflow;
            return {
              ...r,
              runningBalance: currentRunningBalance,
            };
          });

          // Determine month title banner text
          const isOperations = month.name.toUpperCase().includes('JUL') || rawRows.some(r => r.category.toLowerCase().includes('maintenance'));
          const bannerTitle = `${idx + 1}. ${month.name.toUpperCase()} ${year} ${
            idx === 0 && month.id === 'jan'
              ? 'INITIAL CAPITAL & EXPENSES'
              : isOperations
              ? 'CASH FLOW & EXPENSES'
              : 'OPERATIONS (CASH ACCOUNT)'
          }`;

          return (
            <div
              key={month.id}
              className="space-y-1"
              style={{ pageBreakInside: 'avoid' }}
            >
              {/* Blue Banner Header */}
              <div className="bg-[#1e40af] text-white px-2 py-0.5 rounded flex items-center justify-between shadow-2xs">
                <span className="font-bold text-[8.5px] tracking-wider uppercase">
                  {bannerTitle}
                </span>
                <div className="flex items-center gap-1.5 text-[8px] font-mono text-blue-100 font-normal">
                  {calc.totalShareholderDiscounts > 0 && (
                    <span className="text-amber-200 font-semibold">
                      Sh: {formatPHP(calc.totalShareholderDiscounts)}
                    </span>
                  )}
                  {(calc.totalPlatformDiscounts || 0) > 0 && (
                    <span className="text-sky-200 font-semibold">
                      OTA: -{formatPHP(calc.totalPlatformDiscounts || 0)}
                    </span>
                  )}
                  <span>Margin: {calc.profitMargin.toFixed(1)}%</span>
                </div>
              </div>

              {/* High-Precision 6-Column Running Balance Table with Unified NOTES & DISCOUNTS Column */}
              <div className="border border-neutral-200 rounded bg-white shadow-2xs overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed text-[7.5px]">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 font-bold text-[7.5px] uppercase tracking-wider select-none">
                      <th className="py-1 px-1.5 w-[34%]">DATE / DESCRIPTION</th>
                      <th className="py-1 px-1 w-[16%]">CATEGORY</th>
                      <th className="py-1 px-1 w-[20%]">NOTES & DISCOUNTS</th>
                      <th className="py-1 px-1.5 text-right w-[10%]">INFLOW (COB)</th>
                      <th className="py-1 px-1.5 text-right w-[10%]">OUTFLOW (EXP)</th>
                      <th className="py-1 px-1.5 text-right w-[10%]">BALANCE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-[7.5px]">
                    {/* Row 1: Beginning Balance Row */}
                    <tr className="bg-neutral-50/70 font-medium">
                      <td className="py-1 px-1.5 text-neutral-800 break-words leading-tight text-[7.5px]">
                        {month.id === 'jan'
                          ? 'Starting Capital Funds'
                          : `Beginning Balance (from ${
                              monthsData[monthsData.findIndex((m) => m.id === month.id) - 1]?.name || 'Previous'
                            })`}
                      </td>
                      <td className="py-1 px-1 text-neutral-500 italic break-words leading-tight text-[7px]">
                        {month.id === 'jan' ? 'Beginning Cash' : 'Carried Forward'}
                      </td>
                      <td className="py-1 px-1 text-neutral-400 text-[7px]">
                        —
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap text-[7.5px]">
                        {month.id === 'jan' && calc.beginningBalance > 0 ? formatPHP(calc.beginningBalance) : <span className="text-neutral-300 font-normal">—</span>}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono text-neutral-400 text-[7px]">
                        —
                      </td>
                      <td className={`py-1 px-1.5 text-right font-mono whitespace-nowrap font-bold text-[7.5px] ${
                        calc.beginningBalance < 0 ? 'text-red-600' : 'text-neutral-900'
                      }`}>
                        {calc.beginningBalance < 0 ? `-${formatPHP(Math.abs(calc.beginningBalance))}` : formatPHP(calc.beginningBalance)}
                      </td>
                    </tr>

                    {/* Transaction Rows */}
                    {rowsWithRunningBalance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-1.5 text-center text-neutral-400 italic text-[7.5px]">
                          No transactions recorded for {month.name}.
                        </td>
                      </tr>
                    ) : (
                      rowsWithRunningBalance.map((row) => {
                        const hasDiscount = row.discountAmount && row.discountAmount > 0;
                        const hasNotes = Boolean(row.notes);

                        return (
                          <tr key={row.id} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-1 px-1.5 font-medium text-neutral-800 break-words leading-tight text-[7.5px]">
                              {row.date && (
                                <span className="font-semibold text-neutral-900 mr-1 inline">{row.date}:</span>
                              )}
                              <span className="inline text-neutral-800">{row.description}</span>
                            </td>
                            <td className="py-1 px-1 text-neutral-700 break-words leading-tight text-[7px]">
                              {row.category}
                            </td>
                            {/* Unified Notes & Discounts Cell */}
                            <td className="py-1 px-1 text-neutral-600 text-[7px] leading-tight break-words">
                              <div className="flex flex-col gap-0.5">
                                {hasNotes && (
                                  <div className="text-neutral-600 break-words">
                                    {row.notes}
                                  </div>
                                )}
                                {hasDiscount && (
                                  <div className="flex items-center gap-1 font-mono text-[6.5px]">
                                    <span
                                      className={`font-semibold px-0.5 py-0 rounded border whitespace-nowrap ${
                                        row.isShareholderDiscount
                                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                                          : 'bg-sky-50 border-sky-200 text-sky-800'
                                      }`}
                                    >
                                      {row.isShareholderDiscount ? 'Sh Disc:' : 'OTA:'}{' '}
                                      {row.isShareholderDiscount
                                        ? formatPHP(row.discountAmount || 0)
                                        : `-${formatPHP(row.discountAmount || 0)}`}
                                      {row.discountMeta ? ` (${row.discountMeta})` : ''}
                                    </span>
                                  </div>
                                )}
                                {!hasNotes && !hasDiscount && (
                                  <span className="text-neutral-300 font-normal">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-600 whitespace-nowrap text-[7.5px]">
                              {row.inflow > 0 ? formatPHP(row.inflow) : <span className="text-neutral-300 font-normal">—</span>}
                            </td>
                            <td className="py-1 px-1.5 text-right font-mono font-medium text-neutral-800 whitespace-nowrap text-[7.5px]">
                              {row.outflow > 0 ? formatPHP(row.outflow) : <span className="text-neutral-300 font-normal">—</span>}
                            </td>
                            <td className={`py-1 px-1.5 text-right font-mono whitespace-nowrap text-[7.5px] ${
                              row.runningBalance < 0 ? 'text-red-600 font-bold' : 'text-neutral-900 font-semibold'
                            }`}>
                              {row.runningBalance < 0 ? `-${formatPHP(Math.abs(row.runningBalance))}` : formatPHP(row.runningBalance)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Summary Footer Row */}
                  <tfoot>
                    {(() => {
                      const monthShareholderDiscounts = rawRows.reduce(
                        (sum, r) => sum + (r.isShareholderDiscount ? (r.discountAmount || 0) : 0),
                        0
                      );
                      const monthPlatformDiscounts = rawRows.reduce(
                        (sum, r) => sum + (!r.isShareholderDiscount ? (r.discountAmount || 0) : 0),
                        0
                      );
                      return (
                        <tr className="bg-neutral-100 border-t border-neutral-300 font-bold text-neutral-900 text-[7.5px]">
                          <td className="py-1 px-1.5 text-neutral-900 break-words leading-tight">
                            {month.name} Net Summary
                          </td>
                          <td className="py-1 px-1 text-neutral-600 font-semibold break-words leading-tight text-[7px]">
                            Disbursed: {formatPHP(calc.totalExpenses)}
                          </td>
                          <td className="py-1 px-1 text-neutral-700 text-[7px] leading-tight">
                            {monthShareholderDiscounts > 0 || monthPlatformDiscounts > 0 ? (
                              <div className="flex flex-wrap items-center gap-1 font-mono text-[6.5px]">
                                {monthShareholderDiscounts > 0 && (
                                  <span className="text-amber-800 bg-amber-50 px-0.5 py-0 rounded border border-amber-200 whitespace-nowrap" title="Shareholder Repayable Discounts">
                                    Sh: {formatPHP(monthShareholderDiscounts)}
                                  </span>
                                )}
                                {monthPlatformDiscounts > 0 && (
                                  <span className="text-sky-800 bg-sky-50 px-0.5 py-0 rounded border border-sky-200 whitespace-nowrap" title="Airbnb / OTA Platform Deductions">
                                    OTA: -{formatPHP(monthPlatformDiscounts)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono text-emerald-700 whitespace-nowrap text-[7.5px]">
                            {formatPHP(calc.totalNetIncome)}
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono text-rose-600 whitespace-nowrap text-[7.5px]">
                            {formatPHP(calc.totalExpenses)}
                          </td>
                          <td className={`py-1 px-1.5 text-right font-mono text-[7.5px] whitespace-nowrap font-bold ${
                            calc.endingBalance < 0 ? 'text-red-600' : 'text-blue-900'
                          }`}>
                            {calc.endingBalance < 0 ? `-${formatPHP(Math.abs(calc.endingBalance))}` : formatPHP(calc.endingBalance)}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Stamp */}
      <div className="border-t border-neutral-200 pt-1 flex items-center justify-between text-[7.5px] text-neutral-400 font-mono">
        <div>Airbnb Financial Tracker • Executive Cash Flow & Operations Report</div>
        <div>All values in Philippine Pesos (PHP ₱)</div>
      </div>
    </div>
  );
};
