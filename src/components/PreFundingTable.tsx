import React,{useState} from 'react';
import { MergedLedgerItem,Partner,TransactionType } from '../types';
import { MergedLedgerTable } from './MergedLedgerTable';
import { FormattedAmountInput } from './FormattedAmountInput';
import { generateId } from '../utils/formatters';
import { money } from '../utils/accounting';
interface Props {monthId:string;monthName:string;items:MergedLedgerItem[];partners:Partner[];onChange:(items:MergedLedgerItem[])=>void;onOpenPartnersModal:()=>void;beginningBalance?:number;year?:number;}
export function PreFundingTable(props:Props){
 const [show,setShow]=useState(false),[amount,setAmount]=useState<number|''>(''),[type,setType]=useState<TransactionType>('Partner Advance'),[date,setDate]=useState('');
 const split=()=>{if(!amount||!date||props.partners.length===0)return;const shares=props.partners.reduce((s,p)=>s+p.sharePercentage,0);if(shares<=0)return;let allocated=0;const entries=props.partners.map((p,i)=>{const contribution=i===props.partners.length-1?money(amount-allocated):money(amount*p.sharePercentage/shares);allocated+=contribution;return {id:generateId(),date,type,description:'Funding by '+p.name,category:type,receiptNo:'',inflow:contribution,outflow:'' as const,notes:'Explicit allocation by ownership shares',paidBy:p.name,partnerId:p.id,fundingIntent:type==='Partner Advance'?'repayable' as const:'capital' as const,accountingVersion:2};});props.onChange([...props.items,...entries]);setShow(false);};
 return <><div className="funding-helper"><p>Partner advances increase cash and amounts due. Capital contributions increase cash without creating debt. Neither is income.</p><button onClick={()=>setShow(!show)}>Split new funding by shares</button></div>{show&&<div className="funding-form"><label>Total funding <FormattedAmountInput aria-label="Total funding to split" value={amount} onChange={setAmount}/></label><label>Date <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Intent <select value={type} onChange={e=>setType(e.target.value as TransactionType)}><option>Partner Advance</option><option>Capital Contribution</option></select></label><button disabled={!amount||!date||!props.partners.length} onClick={split}>Create partner entries</button></div>}<MergedLedgerTable {...props} view="funding"/></>;
}
