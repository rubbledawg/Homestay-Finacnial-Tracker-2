import { cloudStore as localStorage } from './lib/cloudStore';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MonthData, TabConfig, ExportType, BookingItem, MergedLedgerItem, Partner, MonthCalculations } from './types';
import {
  createEmptyMonths,
  calculateAllMonths,
  isPreFundingItem,
  MONTH_NAMES,
} from './utils/calculations';
import { formatPHP, generateId } from './utils/formatters';
import {
  exportMonthToCSV,
  exportAnnualToCSV,
  exportElementToJPEG,
  exportElementToPDF,
} from './utils/export';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { MonthlySummaryBar } from './components/MonthlySummaryBar';
import { BookingsTable } from './components/BookingsTable';
import { MergedLedgerTable } from './components/MergedLedgerTable';
import { PreFundingTable } from './components/PreFundingTable';
import { ReimbursablesLedgerTable } from './components/ReimbursablesLedgerTable';
import { AnnualOverviewTable } from './components/AnnualOverviewTable';
import { PartnersModal } from './components/PartnersModal';
import { ExportModal } from './components/ExportModal';
import { BusinessModal } from './components/BusinessModal';
import { BackupModal } from './components/BackupModal';
import { BedDouble, Receipt, Layers, Coins, Landmark, Cloud, AlertCircle, X, LogIn } from 'lucide-react';
import { BusinessTracker } from './types';
import {
  recoverMonthsData,
  recoverPartnersData,
  recoverBusinesses,
  calculateDataScore,
  normalizeMonthData,
  isWajBusiness,
  STORAGE_KEY_BUSINESSES,
  STORAGE_KEY_DELETED_BIZ,
  STORAGE_KEY_ACTIVE_BIZ,
  STORAGE_KEY_DATA,
  STORAGE_KEY_PARTNERS,
  STORAGE_KEY_YEAR,
  DEFAULT_PARTNERS,
  DEFAULT_BUSINESSES,
} from './utils/dataRecovery';
import { VERIFIED_JULY_2026_EXPENSES } from './data/initialExpenses';

export default function App() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(() => {
    const savedYear = localStorage.getItem(STORAGE_KEY_YEAR);
    const parsedYear = Number(savedYear);
    return Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : currentYear;
  });

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Multiple Business Trackers state - always ensure Luxinhaus and WAJ Finances are available
  const [businesses, setBusinesses] = useState<BusinessTracker[]>(() => recoverBusinesses());

  const [activeBusinessId, setActiveBusinessId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_BIZ);
    if (saved) return saved;
    const bizList = recoverBusinesses();
    return bizList.length > 0 ? bizList[0].id : 'biz-default';
  });

  // Business Modal state
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessTracker | null>(null);

  // Sync businesses to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(businesses));
  }, [businesses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_BIZ, activeBusinessId);
  }, [activeBusinessId]);

  // Load partners helper
  const loadPartnersForBusiness = (bizId: string): Partner[] => {
    return recoverPartnersData(bizId);
  };

  // Load months data helper
  const loadMonthsForBusiness = (bizId: string, yr: number): MonthData[] => {
    return recoverMonthsData(bizId, yr);
  };

  // Partners state for active business
  const [partners, setPartners] = useState<Partner[]>(() =>
    loadPartnersForBusiness(activeBusinessId)
  );

  const [isPartnersModalOpen, setIsPartnersModalOpen] = useState(false);

  // Months data for active business and year
  const [monthsData, setMonthsData] = useState<MonthData[]>(() =>
    loadMonthsForBusiness(activeBusinessId, year)
  );

  // Sync caches to prevent echo re-renders & infinite update loops
  const lastSavedMonthsRef = useRef<string>('');
  const lastSavedPartnersRef = useRef<string>('');
  const lastSavedBusinessesRef = useRef<string>('');

  // Flags to distinguish local user edits from remote cloud snapshots
  const isRemoteUpdateMonthsRef = useRef<boolean>(false);
  const isRemoteUpdatePartnersRef = useRef<boolean>(false);
  const isRemoteUpdateBusinessesRef = useRef<boolean>(false);

  // When active business changes, load its data and partners
  const handleSelectBusiness = (newBizId: string) => {
    if (newBizId === activeBusinessId) return;
    setActiveBusinessId(newBizId);
    const newPartners = loadPartnersForBusiness(newBizId);
    const newMonths = loadMonthsForBusiness(newBizId, year);
    lastSavedPartnersRef.current = JSON.stringify(newPartners);
    lastSavedMonthsRef.current = JSON.stringify(newMonths);
    isRemoteUpdatePartnersRef.current = true;
    isRemoteUpdateMonthsRef.current = true;
    setPartners(newPartners);
    setMonthsData(newMonths);
  };

  // Save partners when changed
  useEffect(() => {
    const partnersJson = JSON.stringify(partners);
    localStorage.setItem(`${STORAGE_KEY_PARTNERS}_${activeBusinessId}`, partnersJson);
    if (activeBusinessId === 'biz-default') {
      localStorage.setItem(STORAGE_KEY_PARTNERS, partnersJson);
    }
  }, [partners, activeBusinessId]);

  // Save monthsData when changed
  useEffect(() => {
    const monthsJson = JSON.stringify(monthsData);
    localStorage.setItem(`${STORAGE_KEY_DATA}_${activeBusinessId}_${year}`, monthsJson);
    if (activeBusinessId === 'biz-default') {
      localStorage.setItem(`${STORAGE_KEY_DATA}_${year}`, monthsJson);
    }
  }, [monthsData, activeBusinessId, year]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_YEAR, year.toString());
  }, [year]);

  // Save businesses to local storage when changed
  useEffect(() => {
    const bizJson = JSON.stringify(businesses);
    localStorage.setItem(STORAGE_KEY_BUSINESSES, bizJson);
    if (isRemoteUpdateBusinessesRef.current) {
      isRemoteUpdateBusinessesRef.current = false;
    }
  }, [businesses]);

  // Handle business creation and editing
  const handleOpenAddBusiness = () => {
    setEditingBusiness(null);
    setIsBusinessModalOpen(true);
  };

  const handleOpenEditBusiness = (biz: BusinessTracker) => {
    setEditingBusiness(biz);
    setIsBusinessModalOpen(true);
  };

  const handleSaveBusiness = (biz: BusinessTracker) => {
    // If saving or adding, ensure it's removed from deletedBusinessIds
    try {
      const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
      const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      if (deletedIds.includes(biz.id)) {
        const filtered = deletedIds.filter((id) => id !== biz.id);
        localStorage.setItem(STORAGE_KEY_DELETED_BIZ, JSON.stringify(filtered));
      }
    } catch (e) {
      // non-blocking
    }

    if (editingBusiness) {
      // Update existing
      setBusinesses((prev) => {
        const updated = prev.map((b) => (b.id === biz.id ? biz : b));
        localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(updated));
        lastSavedBusinessesRef.current = JSON.stringify(updated);
        return updated;
      });
    } else {
      // Add new
      setBusinesses((prev) => {
        const updated = [...prev, biz];
        localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(updated));
        lastSavedBusinessesRef.current = JSON.stringify(updated);
        return updated;
      });
      setActiveBusinessId(biz.id);
      localStorage.setItem(STORAGE_KEY_ACTIVE_BIZ, biz.id);
      // Initialize with fresh clean months & default partners
      const emptyMonths = createEmptyMonths(year);
      const emptyJson = JSON.stringify(emptyMonths);
      lastSavedMonthsRef.current = emptyJson;
      isRemoteUpdateMonthsRef.current = true;
      setMonthsData(emptyMonths);
      const partnersJson = JSON.stringify(DEFAULT_PARTNERS);
      lastSavedPartnersRef.current = partnersJson;
      isRemoteUpdatePartnersRef.current = true;
      setPartners(DEFAULT_PARTNERS);
      localStorage.setItem(`${STORAGE_KEY_DATA}_${biz.id}_${year}`, emptyJson);
      localStorage.setItem(`${STORAGE_KEY_PARTNERS}_${biz.id}`, partnersJson);
    }
  };

  const handleDeleteBusiness = async (bizId: string) => {
    if (businesses.length <= 1) return; // Keep at least one business
    const remaining = businesses.filter((b) => b.id !== bizId);

    // 1. Immediately update state
    setBusinesses(remaining);

    // 2. Mark as permanently deleted in local storage
    try {
      const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
      const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      if (!deletedIds.includes(bizId)) {
        deletedIds.push(bizId);
        localStorage.setItem(STORAGE_KEY_DELETED_BIZ, JSON.stringify(deletedIds));
      }

      // Persist remaining businesses list
      const remainingJson = JSON.stringify(remaining);
      localStorage.setItem(STORAGE_KEY_BUSINESSES, remainingJson);
      lastSavedBusinessesRef.current = remainingJson;

      // Clean storage across all financial years for this business
      for (const yr of [2024, 2025, 2026, 2027]) {
        localStorage.removeItem(`${STORAGE_KEY_DATA}_${bizId}_${yr}`);
      }
      localStorage.removeItem(`${STORAGE_KEY_DATA}_${bizId}_${year}`);
      localStorage.removeItem(`${STORAGE_KEY_PARTNERS}_${bizId}`);
    } catch (e) {
      console.error('Error cleaning local storage for deleted business:', e);
    }

    // Switch to first remaining business
    if (activeBusinessId === bizId && remaining.length > 0) {
      const nextBiz = remaining[0];
      setActiveBusinessId(nextBiz.id);
      localStorage.setItem(STORAGE_KEY_ACTIVE_BIZ, nextBiz.id);
      setPartners(loadPartnersForBusiness(nextBiz.id));
      setMonthsData(loadMonthsForBusiness(nextBiz.id, year));
    }
    setIsBusinessModalOpen(false);
  };

  // Tab configurations (Annual overview + 12 monthly tabs)
  const tabs: TabConfig[] = useMemo(
    () => [
      { id: 'overview', label: 'Annual Overview', shortLabel: 'Overview', visible: true, isOverview: true },
      ...MONTH_NAMES.map((m) => ({
        id: m.id,
        label: m.name,
        shortLabel: m.shortName,
        visible: true,
      })),
    ],
    []
  );

  const [activeTabId, setActiveTabId] = useState<string>('jul');
  const [tableDisplayMode, setTableDisplayMode] = useState<
    'all' | 'bookings' | 'ledger' | 'prefunding' | 'reimbursables'
  >('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const printReportRef = useRef<HTMLDivElement>(null);

  // If year changes, load that year's data or create empty
  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setMonthsData(loadMonthsForBusiness(activeBusinessId, newYear));
  };

  // Run automated calculations with sequential monthly carryovers
  const calculations = useMemo(() => {
    const janInitialCapital = monthsData.find((m) => m.id === 'jan')?.initialBalanceOverride ?? 0;
    return calculateAllMonths(monthsData, janInitialCapital, partners);
  }, [monthsData, partners]);

  const annualNetProfit = useMemo(() => {
    return (Object.values(calculations) as MonthCalculations[]).reduce(
      (sum, c) => sum + (c?.netProfit || 0),
      0
    );
  }, [calculations]);

  // Current active month data
  const currentMonthIndex = monthsData.findIndex((m) => m.id === activeTabId);
  const currentMonthData = currentMonthIndex >= 0 ? monthsData[currentMonthIndex] : null;
  const prevMonthName = currentMonthIndex > 0 ? monthsData[currentMonthIndex - 1].name : undefined;
  const nextMonthName =
    currentMonthIndex >= 0 && currentMonthIndex < monthsData.length - 1
      ? monthsData[currentMonthIndex + 1].name
      : undefined;

  // All bookings across the entire year for seamless cross-month turnover & conflict detection
  const allYearBookings = useMemo(
    () => monthsData.flatMap((m) => m.bookings || []),
    [monthsData]
  );

  // Active month reimbursable expenses count
  const currentMonthReimbursablesCount = useMemo(() => {
    if (!currentMonthData?.ledger) return 0;
    return currentMonthData.ledger.filter((item) => {
      const isExp = item.type === 'Expense' || (item.outflow !== '' && Number(item.outflow) > 0);
      const isMarked = item.isReimbursable === true;
      const hasPartner = item.paidBy && item.paidBy !== 'Property Funds' && item.paidBy !== 'Property Fund';
      return isExp && (isMarked || Boolean(hasPartner));
    }).length;
  }, [currentMonthData?.ledger]);

  // Active month pre-funding capital injections count
  const currentMonthPreFundingCount = useMemo(() => {
    if (!currentMonthData?.ledger) return 0;
    return currentMonthData.ledger.filter(isPreFundingItem).length;
  }, [currentMonthData?.ledger]);

  // Handlers for month data updates
  const handleUpdateBookings = (newBookings: BookingItem[]) => {
    if (!currentMonthData) return;
    setMonthsData((prev) =>
      prev.map((m) => (m.id === currentMonthData.id ? { ...m, bookings: newBookings } : m))
    );
  };

  const handleUpdateLedger = (newLedger: MergedLedgerItem[]) => {
    if (!currentMonthData) return;
    setMonthsData((prev) =>
      prev.map((m) => (m.id === currentMonthData.id ? { ...m, ledger: newLedger } : m))
    );
  };

  const handleEncodeJulyStatement = () => {
    if (!isWajBusiness(activeBusinessId)) return;
    setMonthsData((prev) =>
      prev.map((m) => {
        if (m.id === 'jul') {
          return {
            ...m,
            ledger: [...VERIFIED_JULY_2026_EXPENSES],
          };
        }
        return m;
      })
    );
  };

  const handleAddPreFunding = () => {
    if (!currentMonthData) return;
    const defaultPartner = partners && partners.length > 0 ? 'All Owners (Split by Equity)' : 'All Owners';
    const newItem: MergedLedgerItem = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      type: 'Income',
      description: 'Owner Working Capital Pre-Funding',
      category: 'Pre-Funding / Injected Funds',
      receiptNo: '',
      inflow: '',
      outflow: '',
      notes: 'Working capital injection for property operations',
      paidBy: defaultPartner,
    };
    handleUpdateLedger([...(currentMonthData.ledger || []), newItem]);
    setTableDisplayMode((prev) => (prev === 'bookings' || prev === 'reimbursables' ? 'prefunding' : prev));
  };

  const handleUpdateInitialCapital = (val: number) => {
    setMonthsData((prev) =>
      prev.map((m) => (m.id === 'jan' ? { ...m, initialBalanceOverride: val } : m))
    );
  };

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportInitialFormat, setExportInitialFormat] = useState<ExportType>('csv');

  // Export handling (CSV, JPEG, PDF)
  const triggerNotification = (msg: string) => {
    setExportSuccessMsg(msg);
    setTimeout(() => {
      setExportSuccessMsg(null);
    }, 4000);
  };

  const handleOpenExportModal = (initialFormat: ExportType = 'csv') => {
    setExportInitialFormat(initialFormat);
    setIsExportModalOpen(true);
  };

  const activeTabObj = tabs.find((t) => t.id === activeTabId);
  const activeTabLabel = activeTabObj ? activeTabObj.label : 'Tracker';

  return (
    <div className="ledger-app min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        businesses={businesses}
        activeBusinessId={activeBusinessId}
        onSelectBusiness={handleSelectBusiness}
        onAddBusiness={handleOpenAddBusiness}
        onEditBusiness={handleOpenEditBusiness}
        onOpenExportModal={handleOpenExportModal}
        isExporting={isExporting}
        exportSuccessMsg={exportSuccessMsg}
        activeTabLabel={activeTabLabel}
        partnersCount={partners.length}
        onOpenPartnersModal={() => setIsPartnersModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
      />

      <div className="local-status">
        Private workspace · Cloud records
      </div>

      {/* Main Workspace */}
      <main className="ledger-workspace flex-1 w-full mx-auto flex flex-col">
        <div className="workspace-heading">
          <div><p className="eyebrow">PROPERTY FINANCES</p><h1>{businesses.find(b => b.id === activeBusinessId)?.name || 'Your ledger'}</h1><p className="workspace-subtitle">Income, expenses and bookings in one place.</p></div>
          <div className="period-label"><span>{activeTabId === 'overview' ? 'Annual overview' : currentMonthData?.name}</span><strong>{year}</strong></div>
        </div>
        {/* Month navigation */}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          monthsData={monthsData}
          year={year}
          onYearChange={handleYearChange}
        />

        {/* Printable/Exportable Document Canvas */}
        <div ref={printReportRef} className="flex-1 flex flex-col p-1 rounded-lg">
          {activeTabId === 'overview' ? (
            /* Annual Overview View */
            <AnnualOverviewTable
              year={year}
              months={monthsData}
              calculations={calculations}
              onSelectMonth={(id) => setActiveTabId(id)}
              partners={partners}
              onOpenPartnersModal={() => setIsPartnersModalOpen(true)}
            />
          ) : currentMonthData ? (
            /* Monthly Ledger View */
            <div className="flex flex-col">
              {/* Monthly Calculation & Carryover Pipeline Banner */}
              <MonthlySummaryBar
                monthName={currentMonthData.name}
                prevMonthName={prevMonthName}
                nextMonthName={nextMonthName}
                calculations={calculations[currentMonthData.id]}
                isFirstMonth={currentMonthData.id === 'jan'}
                initialBalanceOverride={currentMonthData.initialBalanceOverride}
                onUpdateInitialBalance={handleUpdateInitialCapital}
                onAddPreFunding={handleAddPreFunding}
                partners={partners}
                onOpenPartnersModal={() => setIsPartnersModalOpen(true)}
              />

              {/* View layout selector for tables */}
              <div className="ledger-view-selector flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 font-medium">
                  <span>View</span>
                  <div className="inline-flex flex-wrap items-center bg-neutral-900 border border-neutral-800 rounded p-0.5 text-[11px] gap-0.5">
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('all')}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                        tableDisplayMode === 'all'
                          ? 'bg-neutral-800 text-neutral-100 font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>All records</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('ledger')}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                        tableDisplayMode === 'ledger'
                          ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-800/60'
                          : 'text-neutral-400 hover:text-emerald-400'
                      }`}
                    >
                      <Receipt className="w-3 h-3" />
                      <span>
                        Income & Expenses (
                        {(currentMonthData.ledger?.length || 0) +
                          (currentMonthData.bookings?.length || 0)}
                        )
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('bookings')}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                        tableDisplayMode === 'bookings'
                          ? 'bg-sky-950/80 text-sky-300 font-semibold border border-sky-800/60'
                          : 'text-neutral-400 hover:text-sky-400'
                      }`}
                    >
                      <BedDouble className="w-3 h-3" />
                      <span>Bookings ({currentMonthData.bookings?.length || 0})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('prefunding')}
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                        tableDisplayMode === 'prefunding'
                          ? 'bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800/60'
                          : 'text-neutral-400 hover:text-cyan-400'
                      }`}
                    >
                      <Landmark className="w-3 h-3 text-cyan-400" />
                      <span>Pre-Funding ({currentMonthPreFundingCount})</span>
                      {calculations[currentMonthData.id]?.totalPreFunding > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950/90 border border-cyan-700/80 text-[10px] text-cyan-300 font-mono-numbers font-medium">
                          {formatPHP(calculations[currentMonthData.id].totalPreFunding)}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('reimbursables')}
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                        tableDisplayMode === 'reimbursables'
                          ? 'bg-amber-950/80 text-amber-300 font-semibold border border-amber-800/60'
                          : 'text-neutral-400 hover:text-amber-400'
                      }`}
                    >
                      <Coins className="w-3 h-3 text-amber-400" />
                      <span>Reimbursables ({currentMonthReimbursablesCount})</span>
                      {calculations[currentMonthData.id]?.totalPendingReimbursements > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950/90 border border-amber-700/80 text-[10px] text-amber-300 font-mono-numbers font-medium">
                          {formatPHP(calculations[currentMonthData.id].totalPendingReimbursements)} owed
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-500 font-mono hidden sm:block">
                  Auto-calculated in PHP (₱)
                </div>
              </div>

              {/* 1. Merged Income & Expenses Table */}
              {(tableDisplayMode === 'all' || tableDisplayMode === 'ledger') && (
                <MergedLedgerTable
                  monthId={currentMonthData.id}
                  year={year}
                  items={currentMonthData.ledger || []}
                  bookings={currentMonthData.bookings || []}
                  beginningBalance={calculations[currentMonthData.id]?.beginningBalance ?? 0}
                  totalPreFunding={calculations[currentMonthData.id]?.totalPreFunding ?? 0}
                  prevMonthName={prevMonthName}
                  nextMonthName={nextMonthName}
                  isFirstMonth={currentMonthData.id === 'jan'}
                  partners={partners}
                  onChange={handleUpdateLedger}
                  onAddPreFunding={handleAddPreFunding}
                  onOpenPreFunding={() => setTableDisplayMode('prefunding')}
                  onOpenReimbursables={() => setTableDisplayMode('reimbursables')}
                  
                />
              )}

              {/* 2. Separate Bookings Table */}
              {(tableDisplayMode === 'all' || tableDisplayMode === 'bookings') && (
                <BookingsTable
                  monthId={currentMonthData.id}
                  items={currentMonthData.bookings || []}
                  allYearBookings={allYearBookings}
                  partners={partners}
                  onChange={handleUpdateBookings}
                />
              )}

              {/* 3. Dedicated Pre-Funding Table (Split across Owners) */}
              {(tableDisplayMode === 'all' || tableDisplayMode === 'prefunding') && (
                <PreFundingTable
                  monthId={currentMonthData.id}
                  monthName={currentMonthData.name}
                  items={currentMonthData.ledger || []}
                  partners={partners}
                  onChange={handleUpdateLedger}
                  onOpenPartnersModal={() => setIsPartnersModalOpen(true)}
                />
              )}

              {/* 4. Dedicated Partner Reimbursables Ledger */}
              {(tableDisplayMode === 'all' || tableDisplayMode === 'reimbursables') && (
                <ReimbursablesLedgerTable
                  monthId={currentMonthData.id}
                  monthName={currentMonthData.name}
                  items={currentMonthData.ledger || []}
                  partners={partners}
                  onChange={handleUpdateLedger}
                  onOpenPartnersModal={() => setIsPartnersModalOpen(true)}
                />
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500 text-xs">
              Tab not found or hidden. Please select another month from the tab bar.
            </div>
          )}
        </div>
      </main>

      {/* Sleek Minimalist Footer Bar */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950">
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-5 py-2.5 text-[11px] text-neutral-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Philippine Pesos (₱) Ledger</span>
            <span className="text-neutral-700">•</span>
            <span>Automatic Carryover Active</span>
            <span className="text-neutral-700">•</span>
            <span>Bookings Separate & Income/Expenses Merged</span>
          </div>
          <div className="flex items-center gap-3">
            <span>All calculations update in real-time</span>
          </div>
        </div>
      </footer>

      {/* Partners & Shares Modal */}
      <PartnersModal
        isOpen={isPartnersModalOpen}
        onClose={() => setIsPartnersModalOpen(false)}
        partners={partners}
        onSavePartners={setPartners}
        currentNetProfit={currentMonthData ? calculations[currentMonthData.id]?.netProfit || 0 : 0}
        annualNetProfit={annualNetProfit}
        activeMonthName={currentMonthData?.name || 'Selected Month'}
      />

      {/* Export Configuration & Multi-Month Selector Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        year={year}
        monthsData={monthsData}
        calculations={calculations}
        activeMonthId={currentMonthData?.id || (activeTabId !== 'overview' ? activeTabId : 'jul')}
        partners={partners}
        initialFormat={exportInitialFormat}
        onNotify={triggerNotification}
      />

      {/* Business Tracker Manager / Creation Modal */}
      <BusinessModal
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
        onSave={handleSaveBusiness}
        onDelete={handleDeleteBusiness}
        editingBusiness={editingBusiness}
        canDelete={businesses.length > 1}
      />

      {/* Local backup and restore */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={(restoredBusinesses) => {
          if (restoredBusinesses && restoredBusinesses.length > 0) {
            setBusinesses(restoredBusinesses);
            const target = restoredBusinesses.some((b) => b.id === activeBusinessId)
              ? activeBusinessId
              : restoredBusinesses[0].id;
            setActiveBusinessId(target);
            setPartners(recoverPartnersData(target));
            setMonthsData(recoverMonthsData(target, year));
          } else {
            setBusinesses(recoverBusinesses());
            setPartners(recoverPartnersData(activeBusinessId));
            setMonthsData(recoverMonthsData(activeBusinessId, year));
          }
          triggerNotification('Financial records restored from backup');
        }}
      />
    </div>
  );
}
