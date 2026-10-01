import React, { useState, useRef, useMemo } from 'react';
import { MonthData, MonthCalculations, Partner, ExportType } from '../types';
import { ExportReportDocument } from './ExportReportDocument';
import {
  exportSelectedMonthsToCSV,
  exportElementToJPEG,
  exportElementToPDF,
  getUnifiedLedgerRows,
} from '../utils/export';
import { formatPHP } from '../utils/formatters';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Check,
  CheckSquare,
  Square,
  Eye,
  Settings2,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  monthsData: MonthData[];
  calculations: Record<string, MonthCalculations>;
  activeMonthId?: string;
  partners?: Partner[];
  initialFormat?: ExportType;
  onNotify: (msg: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  year,
  monthsData,
  calculations,
  activeMonthId = 'jul',
  partners = [],
  initialFormat = 'csv',
  onNotify,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportType>(initialFormat);
  const [activeTab, setActiveTab] = useState<'select' | 'preview'>('select');
  const [isExporting, setIsExporting] = useState(false);

  // Initialize selected months: default to active month or current month with data
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>(() => {
    if (activeMonthId && activeMonthId !== 'overview') {
      return [activeMonthId];
    }
    return ['jul']; // sensible default
  });

  const printDocumentRef = useRef<HTMLDivElement>(null);

  // Calculate monthly stats for chips
  const monthSummaries = useMemo(() => {
    return monthsData.map((m) => {
      const calc = calculations[m.id];
      const rows = getUnifiedLedgerRows(m);
      const hasData = rows.length > 0 || (calc?.totalNetIncome || 0) > 0 || (calc?.totalExpenses || 0) > 0;
      return {
        id: m.id,
        name: m.name,
        shortName: m.shortName,
        entriesCount: rows.length,
        hasData,
        grossInflow: calc?.totalNetIncome || 0,
        expenses: calc?.totalExpenses || 0,
        netProfit: calc?.netProfit || 0,
      };
    });
  }, [monthsData, calculations]);

  if (!isOpen) return null;

  const toggleMonth = (id: string) => {
    setSelectedMonthIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedMonthIds(monthsData.map((m) => m.id));
  };

  const handleSelectNone = () => {
    setSelectedMonthIds([]);
  };

  const handleSelectActiveOnly = () => {
    if (activeMonthId && activeMonthId !== 'overview') {
      setSelectedMonthIds([activeMonthId]);
    } else {
      setSelectedMonthIds(['jul']);
    }
  };

  const handleSelectWithData = () => {
    const withDataIds = monthSummaries.filter((m) => m.hasData).map((m) => m.id);
    setSelectedMonthIds(withDataIds.length > 0 ? withDataIds : ['jul']);
  };

  const handleSelectQuarter = (q: 1 | 2 | 3 | 4) => {
    const quarterMap: Record<number, string[]> = {
      1: ['jan', 'feb', 'mar'],
      2: ['apr', 'may', 'jun'],
      3: ['jul', 'aug', 'sep'],
      4: ['oct', 'nov', 'dec'],
    };
    setSelectedMonthIds(quarterMap[q] || []);
  };

  // Sort selected months in calendar order
  const sortedSelectedIds = monthsData
    .filter((m) => selectedMonthIds.includes(m.id))
    .map((m) => m.id);

  const selectedCount = sortedSelectedIds.length;

  const handleRunExport = async () => {
    if (selectedCount === 0) return;
    setIsExporting(true);

    try {
      const selectedNames = monthsData
        .filter((m) => sortedSelectedIds.includes(m.id))
        .map((m) => m.shortName)
        .join('_');

      const filename =
        selectedCount === 1
          ? `Airbnb_Financial_${monthsData.find((m) => m.id === sortedSelectedIds[0])?.name}_${year}`
          : selectedCount === 12
          ? `Airbnb_Financial_FullYear_${year}`
          : `Airbnb_Financial_${selectedCount}Months_${year}`;

      if (selectedFormat === 'csv') {
        exportSelectedMonthsToCSV(monthsData, calculations, sortedSelectedIds, year, partners);
        onNotify(`Exported ${selectedCount} month(s) to CSV spreadsheet`);
        onClose();
      } else if (printDocumentRef.current) {
        if (selectedFormat === 'jpeg') {
          await exportElementToJPEG(printDocumentRef.current, filename);
          onNotify(`Saved ${filename}.jpeg image`);
          onClose();
        } else if (selectedFormat === 'pdf') {
          await exportElementToPDF(printDocumentRef.current, filename);
          onNotify(`Saved ${filename}.pdf document`);
          onClose();
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      onNotify('Export failed. Please check browser permissions.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <span>Export Financial Statements & Ledgers</span>
                <span className="text-xs px-2 py-0.2 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono">
                  {year}
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Exports summary cards & income/expenses ledgers organized chronologically by month
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Options vs Live Preview */}
            <div className="inline-flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('select')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeTab === 'select'
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Configure</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Report</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Scope Highlight Notification Banner */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-neutral-200">Export Scope:</span>
              <span className="text-neutral-400">
                Monthly Summary Cards (Option A Labels) & Income & Expenses Ledger only
              </span>
            </div>
            <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              {selectedCount} {selectedCount === 1 ? 'Month' : 'Months'} Selected
            </div>
          </div>

          {activeTab === 'select' ? (
            <div className="space-y-6">
              {/* 1. Format Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  1. Select Export Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* CSV Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('csv')}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      selectedFormat === 'csv'
                        ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50 text-neutral-100'
                        : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <FileSpreadsheet
                      className={`w-5 h-5 mt-0.5 shrink-0 ${
                        selectedFormat === 'csv' ? 'text-emerald-400' : 'text-neutral-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-xs text-neutral-200 flex items-center gap-1.5">
                        <span>CSV Spreadsheet</span>
                        {selectedFormat === 'csv' && (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        Clean multi-month tabular file for Excel / Google Sheets
                      </div>
                    </div>
                  </button>

                  {/* PDF Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('pdf')}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      selectedFormat === 'pdf'
                        ? 'bg-rose-950/40 border-rose-500/80 ring-1 ring-rose-500/50 text-neutral-100'
                        : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 mt-0.5 shrink-0 ${
                        selectedFormat === 'pdf' ? 'text-rose-400' : 'text-neutral-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-xs text-neutral-200 flex items-center gap-1.5">
                        <span>PDF Document</span>
                        {selectedFormat === 'pdf' && (
                          <Check className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        Crisp, formatted multi-page printable statement
                      </div>
                    </div>
                  </button>

                  {/* JPEG Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('jpeg')}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      selectedFormat === 'jpeg'
                        ? 'bg-sky-950/40 border-sky-500/80 ring-1 ring-sky-500/50 text-neutral-100'
                        : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <ImageIcon
                      className={`w-5 h-5 mt-0.5 shrink-0 ${
                        selectedFormat === 'jpeg' ? 'text-sky-400' : 'text-neutral-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-xs text-neutral-200 flex items-center gap-1.5">
                        <span>JPEG Image</span>
                        {selectedFormat === 'jpeg' && (
                          <Check className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        High-resolution visual report snapshot
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Month Picker with Presets */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Choose Months to Include in Export</span>
                  </label>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-300 transition-colors"
                    >
                      All 12 Months
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectActiveOnly}
                      className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-emerald-400 transition-colors font-medium"
                    >
                      Active Month
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectWithData}
                      className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-300 transition-colors"
                    >
                      With Data
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectQuarter(1)}
                      className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                    >
                      Q1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectQuarter(2)}
                      className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                    >
                      Q2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectQuarter(3)}
                      className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                    >
                      Q3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectQuarter(4)}
                      className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                    >
                      Q4
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectNone}
                      className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded text-neutral-500 hover:text-neutral-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* 12 Months Selection Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {monthSummaries.map((m) => {
                    const isSelected = selectedMonthIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMonth(m.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between min-h-[76px] cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-900 border-emerald-500/80 ring-1 ring-emerald-500/40 text-neutral-100'
                            : 'bg-neutral-950 border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900/40'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`font-semibold text-xs ${isSelected ? 'text-emerald-400' : 'text-neutral-300'}`}>
                            {m.name}
                          </span>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600" />
                          )}
                        </div>

                        <div className="text-[10px] font-mono text-neutral-500 mt-1 flex items-center justify-between">
                          <span>{m.entriesCount} entries</span>
                          {m.hasData ? (
                            <span className={m.netProfit >= 0 ? 'text-emerald-400/80 font-medium' : 'text-rose-400/80 font-medium'}>
                              {formatPHP(m.netProfit)}
                            </span>
                          ) : (
                            <span className="text-neutral-600">empty</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Live Preview Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Live Document Preview ({selectedCount} Months Selected):</span>
                <span className="font-mono text-[11px] text-neutral-500">
                  Ready for export
                </span>
              </div>
              <div className="border border-neutral-800 rounded-lg p-2.5 bg-neutral-900/50 max-h-[500px] overflow-auto">
                <div style={{ minWidth: '700px', width: '700px' }} className="mx-auto">
                  <ExportReportDocument
                    year={year}
                    monthsData={monthsData}
                    calculations={calculations}
                    selectedMonthIds={sortedSelectedIds}
                    partners={partners}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-900/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <span>Selected for Export:</span>
            <span className="font-semibold text-neutral-200">
              {selectedCount === 0
                ? 'No months selected'
                : selectedCount === 12
                ? 'Full Year (12 Months)'
                : `${selectedCount} Months (${monthsData
                    .filter((m) => sortedSelectedIds.includes(m.id))
                    .map((m) => m.shortName)
                    .join(', ')})`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded font-medium text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleRunExport}
              disabled={selectedCount === 0 || isExporting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Export...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Export {selectedCount} {selectedCount === 1 ? 'Month' : 'Months'} (
                    {selectedFormat.toUpperCase()})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hidden Document Node for High-Res JPEG & Multi-Page PDF Generation */}
        <div className="absolute left-[-9999px] top-[-9999px]" style={{ width: '700px' }}>
          <div ref={printDocumentRef} style={{ width: '700px' }}>
            <ExportReportDocument
              year={year}
              monthsData={monthsData}
              calculations={calculations}
              selectedMonthIds={sortedSelectedIds}
              partners={partners}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
