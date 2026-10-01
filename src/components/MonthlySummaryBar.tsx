import React from 'react';
import { MonthCalculations, Partner } from '../types';
import { formatPHP } from '../utils/formatters';
import { FormattedAmountInput } from './FormattedAmountInput';
interface Props { monthName:string; prevMonthName?:string; nextMonthName?:string; calculations:MonthCalculations; isFirstMonth?:boolean; initialBalanceOverride?:number; onUpdateInitialBalance?:(value:number)=>void; onAddPreFunding?:()=>void; partners?:Partner[]; onOpenPartnersModal?:()=>void; }
export function MonthlySummaryBar({monthName,prevMonthName,calculations:c,isFirstMonth,initialBalanceOverride,onUpdateInitialBalance,onAddPreFunding}:Props) {
  const metrics=[
    ['Beginning cash',c.beginningBalance,'Cash carried forward',''],
    ['Monthly income',c.totalNetIncome,'Bookings & other business income','positive'],
    ['Business-paid expenses',c.businessPaidExpenses,'Paid from business cash','negative'],
    ['Partner-paid expenses',c.partnerPaidExpenses,'Operating expenses · no cash outflow','attention'],
    ['Net profit / loss',c.netProfit,'Income less all operating expenses',c.netProfit<0?'negative':'positive'],
    ['Ending business cash',c.endingBalance,'Actual cash held by the business',c.endingBalance<0?'negative':'positive'],
    ['Due to partners',c.totalDueToPartners,'Outstanding · carried separately','attention'],
  ];
  return <section id="monthly-summary-bar">
    <div className="summary-heading"><h2>{monthName} summary</h2><div className="summary-actions">{isFirstMonth?<label>Opening cash <FormattedAmountInput aria-label="January Starting Capital" value={initialBalanceOverride ?? 0} onChange={v=>onUpdateInitialBalance?.(v===''?0:v)} className="opening-cash-input" /></label>:<span>Cash from {prevMonthName || 'previous year'}</span>}<button onClick={onAddPreFunding}>Add partner advance</button></div></div>
    <div className="metric-grid">{metrics.map(([label,value,hint,tone])=><div className={'metric-card '+tone} key={String(label)}><span className="metric-label">{label}</span><strong>{formatPHP(Number(value))}</strong><span className="metric-hint">{hint}</span></div>)}</div>
    <div className="cash-equation">Cash: {formatPHP(c.beginningBalance)} opening + {formatPHP(c.cashInflow)} received − {formatPHP(c.cashOutflow)} paid <span>Partner advances {formatPHP(c.partnerAdvances)} · Reimbursements {formatPHP(c.partnerReimbursements)}</span></div>
    {c.reviewItems.length>0 && <details className="review-panel"><summary>{c.reviewItems.length} items need accounting review</summary><ul>{c.reviewItems.map((r,i)=><li key={r.id+'-'+i}><span>{r.label || 'Transaction'}</span> — {r.reason}</li>)}</ul></details>}
  </section>;
}
