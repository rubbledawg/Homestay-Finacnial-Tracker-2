import React from 'react';
import { TabConfig, MonthData } from '../types';
import { LayoutDashboard, ChevronDown } from 'lucide-react';

interface TabBarProps {
  tabs: TabConfig[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  monthsData: MonthData[];
  year: number;
  onYearChange: (year: number) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  monthsData,
  year,
  onYearChange,
}) => {
  return (
    <div className="month-navigation w-full">
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar scroll-smooth">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const monthData = monthsData.find((m) => m.id === tab.id);
          const hasEntries =
            monthData &&
            ((monthData.bookings && monthData.bookings.length > 0) ||
              (monthData.ledger && monthData.ledger.length > 0));

          return (
            <button
              key={tab.id}
              type="button"
              id={`tab-btn-${tab.id}`}
              aria-pressed={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 select-none ${
                isActive
                  ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
              }`}
            >
              {tab.isOverview ? (
                <LayoutDashboard className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    hasEntries ? 'bg-emerald-400' : 'bg-neutral-600'
                  }`}
                />
              )}
              <span>{tab.shortLabel}</span>
            </button>
          );
        })}

        {/* Year Selector directly beside the last month (Dec) */}
        <div className="relative flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded px-2.5 py-1 text-xs shrink-0 ml-1.5 transition-colors">
          <span className="text-neutral-500 text-[11px]">Year:</span>
          <select
            id="tracker-year-select"
            aria-label="Tracker Fiscal Year"
            value={year}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer text-xs pr-4 appearance-none"
          >
            <option value={2024} className="bg-neutral-900 text-neutral-200">2024</option>
            <option value={2025} className="bg-neutral-900 text-neutral-200">2025</option>
            <option value={2026} className="bg-neutral-900 text-neutral-200">2026</option>
            <option value={2027} className="bg-neutral-900 text-neutral-200">2027</option>
          </select>
          <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
