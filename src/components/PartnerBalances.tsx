import React from 'react';
import { MonthCalculations, Partner } from '../types';
import { formatPHP } from '../utils/formatters';
export function PartnerBalances({calculations:c,partners,onEdit}:{calculations:MonthCalculations;partners:Partner[];onEdit?:()=>void}) {
  const balances=c.partnerBalances || {};
  const names=[...new Set([...partners.map(p=>p.name),...Object.keys(balances)])];
  return <section className="partner-section"><div className="section-heading"><h2>Partner balances</h2>{onEdit && <button onClick={onEdit}>Manage partners</button>}</div><p className="section-note">Amounts owed by the business. Ownership shares do not reduce reimbursements.</p><div className="table-scroll"><table className="financial-table"><thead><tr><th>Partner</th><th className="amount">Expenses funded</th><th className="amount">Cash advanced</th><th className="amount">Reimbursed</th><th className="amount">Currently due</th></tr></thead><tbody>{names.map(name=>{const b=balances[name];return <tr key={name}><td>{name}</td><td className="amount">{formatPHP(b?.expensesFunded || 0)}</td><td className="amount">{formatPHP(b?.cashAdvanced || 0)}</td><td className="amount">{formatPHP(b?.reimbursements || 0)}</td><td className="amount attention">{formatPHP(b?.pendingAmount || 0)}</td></tr>;})}</tbody></table></div></section>;
}
