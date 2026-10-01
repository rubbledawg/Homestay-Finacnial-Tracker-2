import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  Check,
  Loader2,
  Building2,
  Users,
  Folder,
  FolderOpen,
  Plus,
  Settings,
  Hotel,
  Car,
  Utensils,
  ShoppingBag,
  Briefcase,
  Layers,
  Cloud,
} from 'lucide-react';
import { ExportType, BusinessTracker } from '../types';

interface HeaderProps {
  businesses: BusinessTracker[];
  activeBusinessId: string;
  onSelectBusiness: (businessId: string) => void;
  onAddBusiness: () => void;
  onEditBusiness: (business: BusinessTracker) => void;
  onOpenExportModal: (initialFormat?: ExportType) => void;
  isExporting: boolean;
  exportSuccessMsg: string | null;
  activeTabLabel: string;
  partnersCount: number;
  onOpenPartnersModal: () => void;
  syncState?: 'idle' | 'loading' | 'synced' | 'saving' | 'error';
  lastSyncedTime?: Date | null;
  onForceRefresh?: () => void;
  onOpenBackupModal?: () => void;
}

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'Vehicle / Car Rental':
      return Car;
    case 'Food & Beverage / Cafe':
      return Utensils;
    case 'Retail & Ecommerce':
      return ShoppingBag;
    case 'Services / Consulting':
      return Briefcase;
    case 'Real Estate / Property':
      return Building2;
    case 'Airbnb / Vacation Rental':
      return Hotel;
    default:
      return Building2;
  }
};

export const Header: React.FC<HeaderProps> = ({
  businesses,
  activeBusinessId,
  onSelectBusiness,
  onAddBusiness,
  onEditBusiness,
  onOpenExportModal,
  isExporting,
  exportSuccessMsg,
  activeTabLabel,
  partnersCount,
  onOpenPartnersModal,
  syncState = 'idle',
  lastSyncedTime,
  onForceRefresh,
  onOpenBackupModal,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) || businesses[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const handleExportSelect = (type: ExportType) => {
    setIsExportMenuOpen(false);
    onOpenExportModal(type);
  };

  const ActiveCategoryIcon = getCategoryIcon(activeBusiness?.category);

  return (
    <header className="app-header w-full sticky top-0 z-40">
      {/* Centered container aligned with the main workspace layout */}
      <div className="header-inner w-full mx-auto px-3 sm:px-4 md:px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Left Side: Brand Logo + Folder-Style Business Tracker Tabs */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0 max-w-full">
          {/* Logo Icon */}
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-rose-400 shrink-0">
            <ActiveCategoryIcon className="w-4 h-4 text-emerald-400" />
          </div>

<span className="app-wordmark">Ledger<span>PRIVATE CLOUD</span></span>
          {/* Property navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[calc(100vw-120px)] sm:max-w-none pb-0.5 scrollbar-none">
            {businesses.map((biz) => {
              const isActive = biz.id === activeBusinessId;
              const BizIcon = getCategoryIcon(biz.category);

              return (
                <div
                  key={biz.id}
                  className={`group relative flex items-center rounded-lg transition-all border ${
                    isActive
                      ? 'bg-neutral-900 border-neutral-700/80 border-b-transparent text-neutral-100 shadow-sm'
                      : 'bg-neutral-950/80 border-neutral-850 hover:border-neutral-700 hover:bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {/* Folder Tab Button */}
                  <button
                    type="button"
                    onClick={() => onSelectBusiness(biz.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium cursor-pointer"
                    title={`${biz.name}${biz.description ? ` • ${biz.description}` : ''}`}
                  >
                    {isActive ? (
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-400 shrink-0" />
                    )}
                    <span className="font-medium max-w-[130px] sm:max-w-[180px] truncate">
                      {biz.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-neutral-950/80 border border-neutral-800 text-[10px] font-mono text-emerald-400">
                      ₱
                    </span>
                  </button>

                  {/* Settings / Edit Button for active folder */}
                  {isActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBusiness(biz);
                      }}
                      className="pr-2 pl-0.5 py-1 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer"
                      title="Rename or edit business tracker settings"
                    >
                      <Settings className="w-3 h-3 hover:rotate-45 transition-transform" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Folder-Style '+' Add Tracker Button */}
            <button
              type="button"
              onClick={onAddBusiness}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900/50 hover:bg-emerald-950/30 border border-dashed border-neutral-800 hover:border-emerald-700/70 text-neutral-400 hover:text-emerald-300 text-xs font-medium transition-colors cursor-pointer shrink-0"
              title="Add another business tracker (e.g. Siargao Villa 2, Car Rental, Laundry)"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] hidden sm:inline">Add property</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Partners, Export Dropdown, and Status */}
        <div className="flex items-center gap-2 text-xs ml-auto shrink-0">
          {/* Export Success Notification */}
          {exportSuccessMsg && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded text-[11px] animate-fadeIn">
              <Check className="w-3 h-3" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}

          {/* Local backup */}
          {onOpenBackupModal && (
            <button
              type="button"
              id="backup-header-btn"
              onClick={onOpenBackupModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-emerald-700/70 hover:bg-neutral-850 text-neutral-200 hover:text-emerald-300 rounded font-medium text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              title="Backup and restore"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Backup</span>
            </button>
          )}

          {/* Partners & Shares Manager Button */}
          <button
            type="button"
            id="partners-modal-open-btn"
            onClick={onOpenPartnersModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-neutral-200 rounded font-medium text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            title="Manage partners, equity shares and profit allocations"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Partners</span>
            <span className="px-1.5 py-0.2 bg-neutral-800 border border-neutral-700 text-[10px] rounded text-emerald-400 font-mono font-medium">
              {partnersCount}
            </span>
          </button>

          {/* Export Dropdown */}
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              id="export-dropdown-btn"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-neutral-200 rounded font-medium text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Export</span>
              <span className="text-[10px] text-neutral-500 font-mono">▾</span>
            </button>

            {isExportMenuOpen && (
              <div
                id="export-menu-dropdown"
                className="absolute right-0 mt-1.5 w-52 bg-neutral-900 border border-neutral-700/80 rounded-lg shadow-2xl py-1 z-50 text-xs"
              >
                <div className="px-3 py-1.5 border-b border-neutral-800 text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
                  Export Options ({activeTabLabel})
                </div>

                {/* CSV */}
                <button
                  type="button"
                  id="export-csv-option"
                  onClick={() => handleExportSelect('csv')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-200 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-medium text-[11px]">CSV Spreadsheet</div>
                    <div className="text-[10px] text-neutral-500">Structured tables for Excel/Sheets</div>
                  </div>
                </button>

                {/* JPEG */}
                <button
                  type="button"
                  id="export-jpeg-option"
                  onClick={() => handleExportSelect('jpeg')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-200 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="font-medium text-[11px]">JPEG Image</div>
                    <div className="text-[10px] text-neutral-500">High-resolution image snapshot</div>
                  </div>
                </button>

                {/* PDF */}
                <button
                  type="button"
                  id="export-pdf-option"
                  onClick={() => handleExportSelect('pdf')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-200 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <div className="font-medium text-[11px]">PDF Document</div>
                    <div className="text-[10px] text-neutral-500">Clean print-ready report</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
