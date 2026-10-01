import React, { useState, useEffect, useRef } from 'react';
import { formatAmountWithCommas, parseAmount } from '../utils/formatters';

interface FormattedAmountInputProps {
  value: number | string | undefined | null;
  onChange: (value: number | '') => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  title?: string;
  min?: number;
  max?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const FormattedAmountInput: React.FC<FormattedAmountInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0.00',
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
  title,
  min,
  max,
  onBlur,
  onFocus,
  onKeyDown,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize display string
  const [display, setDisplay] = useState<string>(() => {
    if (value === '' || value === undefined || value === null) return '';
    return formatAmountWithCommas(value);
  });

  // Synchronize when value changes externally (and input is not focused)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      if (value === '' || value === undefined || value === null) {
        setDisplay('');
      } else {
        setDisplay(formatAmountWithCommas(value));
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const raw = inputEl.value;

    if (raw === '' || raw === '-') {
      setDisplay(raw);
      onChange('');
      return;
    }

    // Save number of non-comma characters before cursor
    const selStart = inputEl.selectionStart || 0;
    const charsBefore = raw.slice(0, selStart);
    const nonCommasBefore = charsBefore.replace(/,/g, '').length;

    // Filter valid characters: digits, at most one decimal dot, optional leading minus
    const isNeg = raw.startsWith('-');
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const intPart = parts[0] || '';
    const hasDot = parts.length > 1;
    const decPart = hasDot ? parts[1] : undefined;

    let formatted = '';
    if (intPart) {
      formatted = parseInt(intPart, 10).toLocaleString('en-US');
    } else if (hasDot) {
      formatted = '0';
    }

    if (hasDot) {
      formatted += '.' + (decPart || '');
    }

    if (isNeg && formatted) {
      formatted = '-' + formatted;
    }

    setDisplay(formatted);

    const numericVal = parseAmount(formatted);
    if (!isNaN(numericVal)) {
      if (min !== undefined && numericVal < min) {
        onChange(min);
      } else if (max !== undefined && numericVal > max) {
        onChange(max);
      } else {
        onChange(numericVal);
      }
    } else {
      onChange('');
    }

    // Restore cursor position relative to non-comma characters
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      let targetPos = 0;
      let counted = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ',') {
          counted++;
        }
        if (counted === nonCommasBefore) {
          targetPos = i + 1;
          break;
        }
      }
      // If at end or before any chars
      if (nonCommasBefore === 0) targetPos = 0;
      else if (counted < nonCommasBefore) targetPos = formatted.length;

      inputRef.current.setSelectionRange(targetPos, targetPos);
    });
  };

  const handleInputBlur = () => {
    if (value === '' || value === undefined || value === null) {
      setDisplay('');
    } else {
      setDisplay(formatAmountWithCommas(value));
    }
    onBlur?.();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      id={id}
      name={name}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
      onBlur={handleInputBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={className}
    />
  );
};
