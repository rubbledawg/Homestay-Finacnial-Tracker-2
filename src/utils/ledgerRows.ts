import { MonthData, Partner, TransactionType } from '../types';
import { bookingAmounts, transactionEffect, sortedTransactions } from './accounting';
export interface UnifiedExportLedgerRow {
 id:string; date:string; type:TransactionType; description:string; category:string; receiptNo:string;
 inflow:number; outflow:number; netAmount:number; cashIn:number; cashOut:number; income:number; expense:number; liabilityChange:number;
 paidBy:string; isReimbursable?:boolean; notes:string; review?:string; isBooking?:boolean;
 discountAmount?:number; discountType?:'amount'|'percent'; discountValue?:number|''; discountBy?:string; discountMeta?:string; isShareholderDiscount?:boolean; nightlyRate?:number; nights?:number;
}
export function getUnifiedLedgerRows(month:MonthData,partners:Partner[]=[]):UnifiedExportLedgerRow[] {
 const rows:UnifiedExportLedgerRow[]=(month.bookings || []).map(b=>{
   const e=bookingAmounts(b);
   return {id:'booking-'+b.id,date:b.date,type:'Income',description:b.guestName || 'Booking',category:'Booking Payout',receiptNo:b.bookingRef || '',
     inflow:e.cash,outflow:0,netAmount:e.cash,cashIn:e.cash,cashOut:0,income:e.cash,expense:0,liabilityChange:0,paidBy:b.unit || 'Booking',notes:[b.status,b.notes].filter(Boolean).join(' · '),isBooking:true,
     discountAmount:e.discount,discountBy:b.discountBy,discountType:b.discountType,discountValue:b.discountValue,nights:e.nights};
 });
 for(const item of month.ledger || []) {
   const e=transactionEffect(item,partners);
   rows.push({id:item.id,date:item.date,type:item.type,description:item.description,category:item.category,receiptNo:item.receiptNo,
     inflow:e.cashIn,outflow:e.cashOut,netAmount:e.cashIn-e.cashOut,cashIn:e.cashIn,cashOut:e.cashOut,income:e.income,expense:e.expense,liabilityChange:e.liabilityChange,
     paidBy:e.partnerPaid || e.advance || e.reimbursement ? e.payer.name : 'Business',isReimbursable:!!e.partnerPaid,notes:item.notes || '',review:e.review});
 }
 return sortedTransactions(rows);
}
export function rowsWithCashBalance(month:MonthData,beginningCash:number,partners:Partner[]=[]){
 let cash=beginningCash;
 return getUnifiedLedgerRows(month,partners).map(row=>{cash=Math.round((cash+row.cashIn-row.cashOut)*100)/100;return {...row,runningBalance:cash};});
}
