import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { LedgerCategory } from '../types';

interface EditableCategoryCellProps {
  value: string;
  isIncome?: boolean;
  isPreFunding?: boolean;
  onChange: (newValue: string) => void;
  ariaLabel?: string;
  size?: 'xs' | 'sm';
}

const STANDARD_INCOME_CATEGORIES: LedgerCategory[] = [
  'Booking Payout',
  'Direct Guest Rental',
  'Cleaning Fee Collected',
  'Extra Guest / Pet Fee',
  'Pre-Funding / Injected Funds',
];

const STANDARD_EXPENSE_CATEGORIES: LedgerCategory[] = [
  'Maintenance & Repairs',
  'Cleaning & Turnover',
  'Utilities (Electricity/Water/WiFi)',
  'Supplies & Toiletries',
  'HOA & Building Dues',
  'Platform & Payment Fees',
  'Property Management',
  'Permits & Taxes',
];

export const EditableCategoryCell: React.FC<EditableCategoryCellProps> = ({
  value,
  isIncome = false,
  isPreFunding = false,
  onChange,
  ariaLabel = 'Category',
  size = 'xs',
}) => {
  const defaultOther = isIncome ? 'Other Inflow' : 'Other Outflow';
  const standardList = isIncome ? STANDARD_INCOME_CATEGORIES : STANDARD_EXPENSE_CATEGORIES;
  const isCustom = value === defaultOther || !standardList.includes(value as any);

  const [isForcedDropdown, setIsForcedDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // When switching to custom input mode, focus and select default text for instant editing
  useEffect(() => {
    if (isCustom && !isForcedDropdown && inputRef.current) {
      inputRef.current.focus();
      if (value === defaultOther) {
        inputRef.current.select();
      }
    }
  }, [isCustom, isForcedDropdown]);

  const textSize = size === 'sm' ? 'text-xs' : 'text-[11px]';
  const pySize = size === 'sm' ? 'py-1' : 'py-1';

  // If in custom mode and not forcing the dropdown, show single editable input box
  if (isCustom && !isForcedDropdown) {
    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          aria-label={ariaLabel}
          value={value}
          placeholder={defaultOther}
          onFocus={(e) => {
            if (value === defaultOther) {
              e.target.select();
            }
          }}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-neutral-950/80 border border-neutral-700 rounded px-2 pr-6 ${pySize} ${textSize} text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 focus:bg-neutral-900 font-normal`}
          title="Custom category. Edit text directly, or click the arrow to pick a standard category."
        />
        <button
          type="button"
          onClick={() => setIsForcedDropdown(true)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-200 rounded cursor-pointer transition-colors"
          title="Choose from standard categories"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Standard select dropdown
  return (
    <select
      aria-label={ariaLabel}
      value={standardList.includes(value as any) ? value : defaultOther}
      onChange={(e) => {
        const val = e.target.value;
        setIsForcedDropdown(false);
        onChange(val);
      }}
      className={`w-full bg-neutral-950/60 border rounded px-1.5 ${pySize} ${textSize} focus:outline-none focus:ring-1 focus:bg-neutral-900 cursor-pointer ${
        isPreFunding
          ? 'border-cyan-800/80 text-cyan-300 font-medium focus:border-cyan-400 focus:ring-cyan-400'
          : 'border-neutral-800 text-neutral-300 focus:border-neutral-500 focus:ring-neutral-500'
      }`}
    >
      <optgroup label={isIncome ? 'Income Categories' : 'Expense Categories'}>
        {standardList.map((cat) => (
          <option key={cat} value={cat} className="bg-neutral-900 text-neutral-200">
            {cat}
          </option>
        ))}
        {isCustom && value && value !== defaultOther && (
          <option value={value} className="bg-neutral-900 text-neutral-200 font-normal">
            {value} (Custom)
          </option>
        )}
        <option value={defaultOther} className="bg-neutral-900 text-neutral-200 font-normal">
          {defaultOther} (Edit text...)
        </option>
      </optgroup>
    </select>
  );
};
