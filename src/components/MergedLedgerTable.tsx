import React, { useState } from 'react';
import { BookingItem, MergedLedgerItem, Partner, TransactionType, ReceiptAttachment } from '../types';
import { formatPHP, generateId, parseAmount } from '../utils/formatters';
import { transactionEffect, isPartnerExpense, isFunding, resolvePartner } from '../utils/accounting';
import { rowsWithCashBalance } from '../utils/ledgerRows';
import { ReceiptCell } from './ReceiptCell';
import { EditableCategoryCell } from './EditableCategoryCell';
import { FormattedAmountInput } from './FormattedAmountInput';
interface Props {monthId:string;year?:number;items:MergedLedgerItem[];bookings?:BookingItem[];beginningBalance?:number;totalPreFunding?:number;prevMonthName?:string;nextMonthName?:string;isFirstMonth?:boolean;partners?:Partner[];onChange:(items:MergedLedgerItem[])=>void;onAddPreFunding?:()=>void;onOpenPreFunding?:()=>void;onOpenReimbursables?:()=>void;onEncodeJulyStatement?:()=>void; view?:'all'|'partner-expenses'|'funding';}
const types:TransactionType[]=['Income','Expense','Partner Advance','Partner Reimbursement','Capital Contribution'];
export function MergedLedgerTable({monthId,year=2026,items,bookings=[],beginningBalance=0,partners=[],onChange,view='all'}:Props) {
 const [filter,setFilter]=useState('All');
 const [collapsed,setCollapsed]=useState(false);
 const update=(id:string,changes:Partial<MergedLedgerItem>)=>onChange(items.map(item=>item.id===id?{...item,...changes}:item));
 const add=(type:TransactionType)=>{setCollapsed(false);const partner=partners[0];onChange([...items,{id:generateId(),date:year+'-'+String(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthId)+1).padStart(2,'0')+'-01',type,description:'',category:type==='Expense'?'Maintenance & Repairs':type==='Income'?'Other Inflow':type,receiptNo:'',inflow:'',outflow:'',notes:'',paidBy:type==='Partner Advance'||type==='Partner Reimbursement'||view==='partner-expenses'?partner?.name:'Business',partnerId:type==='Partner Advance'||type==='Partner Reimbursement'||view==='partner-expenses'?partner?.id:undefined,fundingSource:view==='partner-expenses'?'partner':'business',isReimbursable:view==='partner-expenses',accountingVersion:2}]);};
 const month={id:monthId,name:monthId,shortName:monthId,year,bookings,ledger:items};
 const allRows=rowsWithCashBalance(month,beginningBalance,partners);
 const rows=allRows.filter(row=>{
   const item=items.find(i=>i.id===row.id);
   if(view==='partner-expenses' && (!item || !isPartnerExpense(item)))return false;
   if(view==='funding' && (!item || !(isFunding(item)||item.type==='Partner Reimbursement')))return false;
   return filter==='All'||row.type===filter;
 });
 const title=view==='partner-expenses'?'Partner-paid expenses / reimbursables':view==='funding'?'Partner advances & reimbursements':'Transaction ledger';
 const changeType=(item:MergedLedgerItem,type:TransactionType)=>{
   const inflow=type==='Income'||type==='Partner Advance'||type==='Capital Contribution';
   const amount=parseAmount(item.inflow)||parseAmount(item.outflow)||'';
   update(item.id,{type,inflow:inflow?amount:'',outflow:inflow?'':amount,category:type==='Income'?'Other Inflow':type==='Expense'?'Maintenance & Repairs':type,isReimbursable:type==='Expense'&&item.fundingSource==='partner',fundingIntent:type==='Partner Advance'?'repayable':type==='Capital Contribution'?'capital':undefined,reviewReason:undefined});
 };
 return <section className="ledger-panel"><div className="section-heading"><h2>{title}</h2><div className="entry-actions">{view==='all'&&<button onClick={()=>add('Income')}>+ Income</button>}{view!=='funding'&&<button onClick={()=>add('Expense')}>+ Expense</button>}{view!=='partner-expenses'&&<><button onClick={()=>add('Partner Advance')}>+ Advance</button><button onClick={()=>add('Partner Reimbursement')}>+ Reimbursement</button></>}<button aria-label={collapsed?'Expand transaction ledger':'Collapse transaction ledger'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?'Show':'Hide'}</button></div></div>
 {!collapsed&&<><div className="ledger-toolbar"><span>Business cash {formatPHP(beginningBalance)} at opening · partner-paid expenses do not reduce cash</span><label>Show <select aria-label="Transaction filter" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{types.map(t=><option key={t}>{t}</option>)}</select></label></div><div className="table-scroll"><table className="financial-table transaction-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th>Paid / funded by</th><th>Receipt / ref</th><th className="amount">Amount</th><th className="amount">Cash change</th><th className="amount">Business cash</th><th>Notes / review</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
 {rows.length===0&&<tr><td colSpan={11} className="empty-state">No transactions in this view. Add an entry when money is received or spent.</td></tr>}
 {rows.map((row,index)=>{
   const item=items.find(i=>i.id===row.id);const e=item?transactionEffect(item,partners):null;
   const inflow=item&&(item.type==='Income'||isFunding(item));
   const payer=item?resolvePartner(item,partners):null;
   return <tr key={row.id} className={row.review?'needs-review':''}>
   <td>{item?<input type="date" aria-label={'Date '+item.id} value={item.date} onChange={event=>update(item.id,{date:event.target.value})}/>:row.date}</td>
   <td>{item?<select aria-label={'Type '+item.id} value={item.type} onChange={event=>changeType(item,event.target.value as TransactionType)}>{types.map(t=><option key={t}>{t}</option>)}</select>:<span className="transaction-badge">Booking</span>}</td>
   <td>{item?<input aria-label={'Description '+item.id} placeholder="Description" value={item.description} onChange={event=>update(item.id,{description:event.target.value})}/>:row.description}</td>
   <td>{item?<EditableCategoryCell ariaLabel={'Category '+item.id} value={item.category} isIncome={item.type==='Income'} isPreFunding={isFunding(item)} onChange={category=>update(item.id,{category})} size="xs"/>:row.category}</td>
   <td>{item&&(item.type!=='Income'||isFunding(item))?<select aria-label={'Paid by '+item.id} value={isPartnerExpense(item)||item.type==='Partner Advance'||item.type==='Partner Reimbursement'||item.type==='Capital Contribution'||isFunding(item)?(payer?.id || 'unassigned'):'business'} onChange={event=>{
     const p=partners.find(p=>p.id===event.target.value);update(item.id,{paidBy:p?.name || 'Business',partnerId:p?.id,fundingSource:p?'partner':'business',isReimbursable:item.type==='Expense'&&!!p,reviewReason:undefined});
   }}>{item.type==='Expense'&&<option value="business">Business</option>}<option value="unassigned" disabled>Select partner</option>{partners.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>:row.paidBy}</td>
   <td>{item?<ReceiptCell ariaLabel={'Receipt '+item.id} receiptNo={item.receiptNo} attachments={item.attachments} receiptImage={item.receiptImage} receiptImageName={item.receiptImageName} onUpdateReceipt={(receiptNo,attachments:ReceiptAttachment[])=>update(item.id,{receiptNo,attachments,receiptImage:attachments[0]?.url,receiptImageName:attachments[0]?.name})}/>:row.receiptNo || '—'}</td>
   <td className="amount">{item?<FormattedAmountInput aria-label={'Amount '+item.id} placeholder="—" value={inflow?item.inflow:item.outflow} onChange={amount=>{if(amount!==''&&amount<0)return;update(item.id,inflow?{inflow:amount,outflow:''}:{outflow:amount,inflow:''});}} className="amount-input"/>:formatPHP(row.income)}</td>
   <td className={'amount '+(row.netAmount<0?'negative':row.netAmount>0?'positive':'')}>{row.netAmount?formatPHP(row.netAmount):'—'}</td><td className={'amount '+(row.runningBalance<0?'negative':'')}>{formatPHP(row.runningBalance)}</td>
   <td>{item?<><input aria-label={'Notes '+item.id} value={item.notes} placeholder="Notes" onChange={event=>update(item.id,{notes:event.target.value})}/>{row.review&&<details className="row-review"><summary>Review needed</summary><p>{row.review}</p>{isFunding(item)&&item.type==='Income'&&<select aria-label={'Funding intent '+item.id} value={item.fundingIntent || ''} onChange={event=>update(item.id,{fundingIntent:event.target.value as 'repayable'|'capital',reviewReason:undefined})}><option value="" disabled>Funding intent</option><option value="repayable">Repayable advance</option><option value="capital">Capital contribution</option></select>}<button onClick={()=>{if(confirm('Confirm you have checked the payer, cash movement and any legacy settlement. The original fields remain preserved.'))update(item.id,{reviewReason:undefined,accountingVersion:2,legacySettlementReviewed:true});}}>Mark reviewed</button></details>}</>:row.notes}</td>
   <td>{item&&<button className="delete-entry" aria-label={'Delete '+item.description} onClick={()=>{if(confirm('Remove this transaction? A cloud snapshot preserves the previous records.'))onChange(items.filter(i=>i.id!==item.id));}}>×</button>}</td></tr>;
 })}</tbody><tfoot><tr><td colSpan={8}>Ending business cash · all transactions</td><td className="amount">{formatPHP(allRows.at(-1)?.runningBalance ?? beginningBalance)}</td><td colSpan={2}>Partner debt is separate</td></tr></tfoot></table></div></>}
 </section>;
}
