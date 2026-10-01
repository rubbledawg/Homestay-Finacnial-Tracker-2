# Airbnb & Rental Property Financial Management System
## Base Architecture & Specification for ChatGPT Astra / AI Projects

---

### 1. Executive Summary
This application is a specialized financial tracker and property accounting management system designed for Airbnb hosts, short-term rental operators, and property management partnerships. It handles reservation booking management, multi-partner equity share distributions, out-of-pocket partner reimbursables, cash-flow ledgers, and multi-year roll-over calculations.

---

### 2. Technology Stack
- **Framework**: React 19 (Functional components, custom hooks)
- **Language**: TypeScript 5.8+ (Strict type-checking)
- **Build Tool**: Vite 6+
- **Styling**: Tailwind CSS (Dark-mode optimized, compact financial data grid layout)
- **Typography**: Inter / Plus Jakarta Sans (body) paired with JetBrains Mono (monospaced financial numbers with tabular numerals `tnum`)
- **Icons**: Lucide React
- **Export Engines**: 
  - `jspdf` for vector PDF report exports
  - `html-to-image` for high-resolution JPEG balance sheet snapshots
  - Native CSV exporter for spreadsheet compatibility
- **Persistence & Cloud Sync**:
  - **Local Layer**: Fast offline-first state with auto-saving to `localStorage`
  - **Cloud Layer**: Optional real-time multi-device synchronization with Google Firebase Firestore and Google Auth.

---

### 3. Core Directory & Module Structure

```text
├── index.html                   # Application entry point
├── metadata.json                # Platform metadata
├── package.json                 # Dependencies and build scripts
├── vite.config.ts               # Vite configuration with Tailwind plugin
├── tsconfig.json                # TypeScript compiler config
├── PROJECT_TRANSFER_SPEC.md     # This comprehensive transfer document
│
└── src/
    ├── main.tsx                 # React entry point with AuthProvider
    ├── App.tsx                  # Main orchestration container and sync loop
    ├── index.css                # Global CSS, scrollbar styles, and font imports
    ├── types.ts                 # Core domain models and interface contracts
    │
    ├── context/
    │   └── AuthContext.tsx      # Firebase Google Authentication context & user state
    │
    ├── lib/
    │   ├── firebase.ts          # Firebase SDK initialization (Auth & Firestore)
    │   └── firestoreService.ts  # Cloud CRUD operations and snapshot subscriptions
    │
    ├── data/
    │   └── initialExpenses.ts   # Clean starter templates (empty by default)
    │
    ├── utils/
    │   ├── calculations.ts      # Rollover, cashflow, net profit, and equity math
    │   ├── formatters.ts        # Currency (₱ PHP), date, and number formatters
    │   ├── export.ts            # CSV, JPEG, and PDF export pipelines
    │   ├── dataRecovery.ts      # LocalStorage backup, restore, and hydration helpers
    │   └── receiptUtils.ts      # Image compression and receipt attachment storage
    │
    └── components/
        ├── Header.tsx                 # App header with business switcher & year selector
        ├── TabBar.tsx                 # Monthly navigation tabs (Jan-Dec + Annual)
        ├── MonthlySummaryBar.tsx      # Top metrics card (Inflows, Outflows, Net, Equity)
        ├── BookingsTable.tsx          # Guest bookings, platform fees, discount breakdown
        ├── MergedLedgerTable.tsx      # Unified chronological income & expense journal
        ├── PreFundingTable.tsx        # Injected partner capital tracking
        ├── ReimbursablesLedgerTable.tsx # Partner out-of-pocket claims and settlements
        ├── AnnualOverviewTable.tsx    # 12-month consolidated financial summary
        ├── BookingCalendarModal.tsx   # Interactive visual check-in/out reservation calendar
        ├── BusinessModal.tsx          # Property / business entity management
        ├── PartnersModal.tsx          # Equity percentage configuration (must equal 100%)
        ├── CloudSyncModal.tsx         # Cloud sync status and manual sync triggers
        ├── ReceiptModal.tsx           # Full-resolution receipt photo viewer
        ├── ExportModal.tsx            # Export dialog for PDF, JPEG, and CSV formats
        └── FormattedAmountInput.tsx   # Precision financial number input with currency prefix
```

---

### 4. Domain Data Models (`src/types.ts`)

```typescript
// 1. Property / Business Entity
export interface BusinessTracker {
  id: string;
  name: string;
  category: string;
  currency: string;
  description: string;
  createdAt: number;
}

// 2. Equity Partner
export interface Partner {
  id: string;
  name: string;
  sharePercentage: number; // e.g. 50 for 50%
}

// 3. Reservation / Booking Item
export interface BookingItem {
  id: string;
  date: string;              // YYYY-MM-DD (Check-in)
  checkOutDate?: string;     // YYYY-MM-DD (Check-out)
  unit: string;              // e.g. "Main Villa", "Unit 101"
  guestName: string;
  bookingRef?: string;
  nights: number | '';
  nightlyRate?: number | '';
  rateMode?: 'nightly' | 'monthly';
  monthlyRate?: number | '';
  grossPayout?: number | '';
  platformFee?: number | ''; // Channel fee (e.g. Airbnb fee)
  discount: number | '';
  discountType?: 'amount' | 'percent';
  discountValue?: number | '';
  discountBy?: string;
  netPayout: number | '';    // Calculated net remittance
  status: 'Confirmed' | 'Completed' | 'Cancelled' | 'Pending';
  notes: string;
}

// 4. Cash Flow & Expense Ledger Item
export interface MergedLedgerItem {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  description: string;
  category: string;          // e.g. Maintenance, Utilities, Cleaning, Supplies, Labor
  receiptNo: string;
  receiptImage?: string;     // Base64 / Data URL of physical receipt
  inflow: number | '';
  outflow: number | '';
  notes: string;
  paidBy?: string;           // "Property Funds" or Partner Name
  isReimbursable?: boolean;  // True if partner paid out-of-pocket
  reimbursementStatus?: 'Pending' | 'Settled';
  settlementDate?: string;
}

// 5. Month Envelope Container
export interface MonthData {
  id: string;                // 'jan', 'feb', ..., 'dec'
  name: string;
  shortName: string;
  year: number;
  initialBalanceOverride?: number;
  bookings: BookingItem[];
  ledger: MergedLedgerItem[];
}
```

---

### 5. Mathematical & Business Logic Specifications

#### A. Reservation Calculation Formula
1. **Nights**: Auto-derived from `checkOutDate - date`.
2. **Gross Total**:
   - In Nightly mode: `nights × nightlyRate`
   - In Monthly mode: `(nights / 30) × monthlyRate`
3. **Discount Deduction**: Calculated either as fixed amount or percentage of gross.
4. **Net Payout Remittance**:
   $$\text{Net Payout} = \text{Gross Payout} - \text{Platform Fee} - \text{Discount}$$

#### B. Monthly Cash Flow & Rollover Calculation
For each month $m$ (from January through December):
1. **Beginning Balance ($B_m$)**:
   - For January: Defaults to `initialBalanceOverride` if set, otherwise $0.
   - For February–December: Automatically carries over the **Ending Balance** of month $m-1$:
     $$B_m = E_{m-1}$$
2. **Total Inflows ($I_m$)**:
   $$I_m = \sum \text{Bookings Net Payout} + \sum \text{Ledger Inflows}$$
3. **Total Outflows ($O_m$)**:
   $$O_m = \sum \text{Ledger Outflows}$$
4. **Net Operating Cash Flow ($N_m$)**:
   $$N_m = I_m - O_m$$
5. **Ending Cash Balance ($E_m$)**:
   $$E_m = B_m + N_m$$

#### C. Partner Equity Profit Distribution
1. Net Distributable Profit is computed from the monthly operating performance.
2. For each partner $p$ with equity share $S_p$:
   $$\text{Partner Payout}_p = \text{Distributable Profit} \times \left(\frac{S_p}{100}\right)$$
3. The sum of all partner shares $\sum S_p$ is strictly validated to equal $100\%$.

#### D. Out-of-Pocket Reimbursable Balancing
1. When a partner pays an expense using personal funds (`paidBy = "Partner Name"`, `isReimbursable = true`), it is recorded as a liability owed by the property.
2. Settlements can be tracked as "Pending" or "Settled".
3. The Reimbursables Ledger summarizes:
   - Total amount advanced by each partner
   - Pending balance to be reimbursed from property cash flow
   - Fair-share variance between partners.

---

### 6. Running and Deploying the Project

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev
# Application will run on http://localhost:3000

# 3. Production build
npm run build

# 4. Preview production build
npm run preview
```

### 7. How to Transfer into ChatGPT Astra
1. Upload this file (`PROJECT_TRANSFER_SPEC.md`) directly into Astra or copy its content into the system prompt / project instructions.
2. If uploading project files, you can upload the `src/` directory directly or upload the project ZIP without any database files or personal records.
3. Astra will immediately understand the full schema, component structure, state management, and financial calculation engine.
