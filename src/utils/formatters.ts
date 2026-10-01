/**
 * Formats a number to Philippine Peso (PHP / ₱)
 */
export function formatPHP(value: number | undefined | null, showDecimals = true): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '₱0.00';
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value);
}

/**
 * Clean number string formatter without currency symbol for raw inputs or totals
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.00';
  }
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a number or numeric string with thousand-separator commas
 * e.g. 21035 -> "21,035", 21035.5 -> "21,035.5", "" -> ""
 */
export function formatAmountWithCommas(
  value: number | string | undefined | null,
  forceDecimals = false
): string {
  if (value === undefined || value === null || value === '') return '';
  const strVal = String(value).trim();
  if (strVal === '') return '';

  const isNegative = strVal.startsWith('-');
  const cleaned = strVal.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';

  const parts = cleaned.split('.');
  const integerDigits = parts[0];
  const decimalDigits = parts.length > 1 ? parts[1] : undefined;

  const formattedInt = integerDigits
    ? parseInt(integerDigits, 10).toLocaleString('en-US')
    : '0';

  let result = formattedInt;
  if (decimalDigits !== undefined) {
    result += `.${decimalDigits}`;
  } else if (forceDecimals) {
    result += '.00';
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Parses numeric input string safely (supports strings with commas, currency symbols, etc.)
 */
export function parseAmount(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats date or date range string (e.g., "Jan 5 - Jan 10")
 */
export function formatDateRange(checkIn?: string, checkOut?: string): string {
  if (checkIn && checkOut) {
    return `${checkIn} to ${checkOut}`;
  }
  return checkIn || checkOut || '';
}

/**
 * Generate unique IDs
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}
