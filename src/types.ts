export interface BookingItem {
  id: string;
  date: string; // Check-in date (YYYY-MM-DD)
  checkOutDate?: string; // Check-out date (YYYY-MM-DD)
  unit: string; // e.g. 'Unit 1', 'Unit 2', 'Unit 3'
  channel?: string; // backwards compatibility
  guestName: string;
  bookingRef?: string;
  nights: number | ''; // auto-calculated with calendar
  nightlyRate?: number | ''; // auto-calculated or entered (₱/night)
  rateMode?: 'nightly' | 'monthly'; // 'nightly' (₱/nt) or 'monthly' (₱/mo)
  monthlyRate?: number | ''; // monthly rate (₱/mo)
  grossPayout?: number | '';
  platformFee?: number | '';
  discount: number | ''; // discount applied per night (₱/nt)
  discountType?: 'amount' | 'percent'; // 'amount' (₱) or 'percent' (%)
  discountValue?: number | ''; // raw value if percent (e.g. 10 for 10%)
  discountBy?: string; // e.g. Partner name (Locsin, Laspinas), Airbnb, or Booking
  netPayout: number | ''; // net payout (₱)
  status: string; // Confirmed, Completed, Cancelled, Pending
  notes: string;
}

export type TransactionType = 'Income' | 'Expense';

export type LedgerCategory =
  // Income categories
  | 'Booking Payout'
  | 'Direct Guest Rental'
  | 'Cleaning Fee Collected'
  | 'Extra Guest / Pet Fee'
  | 'Pre-Funding / Injected Funds'
  | 'Other Inflow'
  // Expense categories
  | 'Maintenance & Repairs'
  | 'Cleaning & Turnover'
  | 'Utilities (Electricity/Water/WiFi)'
  | 'Supplies & Toiletries'
  | 'HOA & Building Dues'
  | 'Platform & Payment Fees'
  | 'Property Management'
  | 'Permits & Taxes'
  | 'Other Outflow';

export interface ReceiptAttachment {
  id: string;
  url: string; // base64 data URL or image URL for proof
  name: string; // original file name of receipt
  size?: number; // file size in bytes
  uploadedAt?: string; // ISO date timestamp
}

export interface MergedLedgerItem {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  category: string;
  receiptNo: string;
  attachments?: ReceiptAttachment[]; // multiple attachments support
  receiptImage?: string; // backwards compatibility: primary image data URL
  receiptImageName?: string; // backwards compatibility: primary image file name
  inflow: number | ''; // Income amount (₱)
  outflow: number | ''; // Expense amount (₱)
  notes: string;
  paidBy?: string; // e.g. 'Property Funds' or Partner Name
  isReimbursable?: boolean; // true if partner paid out-of-pocket
  reimbursementStatus?: 'Pending' | 'Settled';
  settlementDate?: string;
  settlementNotes?: string;
}

export interface PartnerReimbursementBalance {
  partnerName: string;
  totalPaid: number;
  pendingAmount: number;
  settledAmount: number;
  fairSharePending?: number;
  netPendingBalance?: number; // > 0 to receive from partners, < 0 owes other partners
}

export interface MonthData {
  id: string; // 'jan', 'feb', ...
  name: string; // 'January', 'February', ...
  shortName: string; // 'Jan', 'Feb', ...
  year: number;
  initialBalanceOverride?: number; // Only for first month if user wants custom starting capital
  bookings: BookingItem[];
  ledger: MergedLedgerItem[];
  // Backwards compatibility fallbacks
  income?: any[];
  expenses?: any[];
}

export interface MonthCalculations {
  beginningBalance: number;
  totalPreFunding: number; // Pre-funding for additional injected funds
  totalOpeningCash: number; // beginningBalance + totalPreFunding
  totalBookingsGross: number;
  totalBookingsFees: number;
  totalBookingsDiscounts: number; // Sum of all booking discounts
  totalDiscounts?: number; // Alias for totalBookingsDiscounts
  totalShareholderDiscounts: number; // Discounts given by shareholders (repayable by partner, does not reduce cash inflow)
  totalPlatformDiscounts: number; // Discounts given by Airbnb / Booking / OTA channels (reduces payout)
  shareholderDiscountBreakdown?: Record<string, number>; // Breakdown of shareholder discounts by partner name
  totalBookingsNet: number;
  totalOtherIncome: number;
  totalOperatingRevenue?: number; // Bookings net + other income (excluding pre-funding)
  totalNetIncome: number; // Bookings net + other income + prefunding for this month
  totalExpenses: number; // Total outflows for this month
  totalCalculatedInflow: number; // Total Inflow in ledger (Beg. Balance if >= 0 + monthly net income)
  totalCalculatedOutflow: number; // Total Outflow in ledger (Opening deficit if < 0 + monthly expenses)
  monthlyNetProfit: number; // Monthly Net P&L (Monthly Inflow - Monthly Expenses)
  netProfit: number; // Monthly Net Profit / Loss
  endingBalance: number; // Total Cash Balance (Beginning Balance + Monthly Net P&L)
  profitMargin: number; // Monthly operating margin %
  totalNights: number;
  totalReimbursables: number; // Out-of-pocket expenses paid by partners
  totalPendingReimbursements: number; // Reimbursables not yet settled
  totalSettledReimbursements: number; // Reimbursables already settled
  partnerBalances?: Record<string, PartnerReimbursementBalance>;
}

export interface TabConfig {
  id: string;
  label: string;
  shortLabel: string;
  visible: boolean;
  isOverview?: boolean;
}

export interface Partner {
  id: string;
  name: string;
  sharePercentage: number; // e.g. 50 for 50%
  notes?: string;
}

export interface BusinessTracker {
  id: string;
  name: string;
  category?: string; // e.g. 'Airbnb / Rental', 'Retail', 'F&B', 'Services', 'Vehicle', 'Other'
  currency: string; // 'PHP'
  description?: string;
  createdAt: number;
}

export type ExportType = 'csv' | 'jpeg' | 'pdf';

