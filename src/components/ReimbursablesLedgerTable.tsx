import React from 'react';
import { MergedLedgerItem,Partner } from '../types';
import { MergedLedgerTable } from './MergedLedgerTable';
interface Props {monthId:string;monthName:string;items:MergedLedgerItem[];partners:Partner[];onChange:(items:MergedLedgerItem[])=>void;onOpenPartnersModal?:()=>void;beginningBalance?:number;year?:number;}
export function ReimbursablesLedgerTable(props:Props){return <MergedLedgerTable {...props} view="partner-expenses"/>;}
