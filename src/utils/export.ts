import { toJpeg,toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { MonthData,MonthCalculations,Partner } from '../types';
import { rowsWithCashBalance } from './ledgerRows';
export { getUnifiedLedgerRows } from './ledgerRows';
export type { UnifiedExportLedgerRow } from './ledgerRows';
const cell=(value:unknown)=>'"'+String(value ?? '').replace(/"/g,'""')+'"';
export function buildSelectedMonthsCSV(months:MonthData[],calculations:Record<string,MonthCalculations>,ids:string[],year:number,partners:Partner[]=[]){
 const lines:string[]=[cell('PROPERTY LEDGER · PRIVATE FINANCIAL REPORT'),cell('Reporting year '+year),cell('Cash, operating performance and partner balances are separate.'),''];
 for(const month of months.filter(m=>ids.includes(m.id))){
  const c=calculations[month.id];if(!c)continue;
  lines.push(cell(month.name+' '+year));
  lines.push(['Beginning cash','Business income','Operating expenses','Business-paid expenses','Partner-paid expenses','Net profit / loss','Partner advances','Reimbursements','Ending business cash','Due to partners'].map(cell).join(','));
  lines.push([c.beginningBalance,c.totalNetIncome,c.totalExpenses,c.businessPaidExpenses,c.partnerPaidExpenses,c.netProfit,c.partnerAdvances,c.partnerReimbursements,c.endingBalance,c.totalDueToPartners].map(n=>cell(n.toFixed(2))).join(','));
  lines.push(['Date','Type','Description','Category','Paid / funded by','Operating income','Operating expense','Cash received','Cash paid','Business cash','Partner liability change','Notes','Review'].map(cell).join(','));
  for(const r of rowsWithCashBalance(month,c.beginningBalance,partners))lines.push([r.date,r.type,r.description,r.category,r.paidBy,r.income.toFixed(2),r.expense.toFixed(2),r.cashIn.toFixed(2),r.cashOut.toFixed(2),r.runningBalance.toFixed(2),r.liabilityChange.toFixed(2),r.notes,r.review || ''].map(cell).join(','));
  lines.push(['Partner','Expenses personally funded','Cash advanced','Reimbursed','Amount due'].map(cell).join(','));
  for(const b of Object.values(c.partnerBalances || {}))lines.push([b.partnerName,b.expensesFunded || 0,b.cashAdvanced || 0,b.reimbursements || 0,b.pendingAmount].map(cell).join(','));
  for(const r of c.reviewItems)lines.push([cell('Needs review'),cell(r.id),cell(r.reason)].join(','));
  lines.push('');
 }
 return '\uFEFF'+lines.join('\r\n');
}
export function exportSelectedMonthsToCSV(months:MonthData[],calculations:Record<string,MonthCalculations>,ids:string[],year:number,partners?:Partner[]){
 const csv=buildSelectedMonthsCSV(months,calculations,ids,year,partners);
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='Property_Ledger_'+year+'.csv';a.click();URL.revokeObjectURL(url);
}
export function exportMonthToCSV(month:MonthData,c:MonthCalculations,year:number,partners?:Partner[]){exportSelectedMonthsToCSV([month],{[month.id]:c},[month.id],year,partners);}
export function exportAnnualToCSV(months:MonthData[],c:Record<string,MonthCalculations>,year:number,partners?:Partner[]){exportSelectedMonthsToCSV(months,c,months.map(m=>m.id),year,partners);}
export async function exportElementToJPEG(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toJpeg(element, {
    quality: 0.95,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
    fontEmbedCSS: '',
    style: {
      borderRadius: '0',
    },
  });

  const link = document.createElement('a');
  link.download = `${filename}.jpeg`;
  link.href = dataUrl;
  link.click();
}

/**
 * Captures an HTML element and triggers a crisp, multi-page PDF download
 */
export async function exportElementToPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
    fontEmbedCSS: '',
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const imgWidth = img.width;
  const imgHeight = img.height;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = (imgHeight * contentWidth) / imgWidth;

  if (contentHeight <= pageHeight - margin * 2) {
    // Single page
    pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, contentHeight);
  } else {
    // Multi-page slicing
    const pageContentHeight = pageHeight - margin * 2;
    let heightLeft = contentHeight;
    let position = margin;

    pdf.addImage(dataUrl, 'PNG', margin, position, contentWidth, contentHeight);
    heightLeft -= pageContentHeight;

    while (heightLeft > 0) {
      position = margin - (contentHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= pageContentHeight;
    }
  }

  pdf.save(`${filename}.pdf`);
}
