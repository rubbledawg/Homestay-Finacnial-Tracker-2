import React, { useState, useEffect } from 'react';
import { BookingItem, Partner } from '../types';
import { formatPHP, parseAmount, generateId } from '../utils/formatters';
import { isShareholderDiscount } from '../utils/calculations';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  Plus,
  Trash2,
  BedDouble,
  ChevronUp,
  ChevronDown,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { BookingCalendarModal } from './BookingCalendarModal';

interface BookingsTableProps {
  monthId: string;
  items: BookingItem[];
  allYearBookings?: BookingItem[];
  partners?: Partner[];
  onChange: (items: BookingItem[]) => void;
}

const DEFAULT_PARTNERS: Partner[] = [
  { id: 'p-1', name: 'Locsin', sharePercentage: 42.07 },
  { id: 'p-2', name: 'Laspinas', sharePercentage: 57.93 },
];

const UNITS = ['Unit 1', 'Unit 2', 'Unit 3'];

const STATUS_OPTIONS = [
  'Confirmed',
  'Completed',
  'Pending Payout',
  'Cancelled',
];

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseDateOnly(s?: string): Date | null {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateRange(checkIn?: string, checkOut?: string): string {
  if (!checkIn) return 'Select Dates';
  const d1 = parseDateOnly(checkIn);
  if (!d1) return checkIn;

  if (!checkOut || checkIn === checkOut) {
    return d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const d2 = parseDateOnly(checkOut);
  if (!d2) {
    return d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
    return `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${d2.getDate()}`;
  }
  return `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// Conflict detection between bookings in the same unit
function hasBookingConflict(booking: BookingItem, allBookings: BookingItem[]): boolean {
  if (!booking.date || booking.status === 'Cancelled') return false;
  const startA = parseDateOnly(booking.date);
  if (!startA) return false;

  let endA = parseDateOnly(booking.checkOutDate);
  if (!endA) {
    const n = typeof booking.nights === 'number' && booking.nights > 0 ? booking.nights : 1;
    endA = new Date(startA);
    endA.setDate(endA.getDate() + n);
  }

  const currentUnit = booking.unit || booking.channel || 'Unit 1';

  return allBookings.some((other) => {
    if (other.id === booking.id || other.status === 'Cancelled' || !other.date) return false;
    const otherUnit = other.unit || other.channel || 'Unit 1';
    if (otherUnit !== currentUnit) return false;

    const startB = parseDateOnly(other.date);
    if (!startB) return false;
    let endB = parseDateOnly(other.checkOutDate);
    if (!endB) {
      const n = typeof other.nights === 'number' && other.nights > 0 ? other.nights : 1;
      endB = new Date(startB);
      endB.setDate(endB.getDate() + n);
    }

    // Overlap condition: startA < endB && startB < endA
    return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
  });
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  monthId,
  items,
  allYearBookings,
  partners,
  onChange,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [tableRateMode, setTableRateMode] = useState<'nightly' | 'monthly'>('nightly');
  const [activeCalendarBooking, setActiveCalendarBooking] = useState<BookingItem | null>(null);
  const [activeCalendarAnchor, setActiveCalendarAnchor] = useState<DOMRect | null>(null);

  const partnerList = partners && partners.length > 0 ? partners : DEFAULT_PARTNERS;

  const defaultMonthIndex = MONTH_MAP[monthId.toLowerCase()] ?? new Date().getMonth();

  const getMonthDefaultDates = (monthIndex: number, yearNum = 2026) => {
    const checkIn = `${yearNum}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const nextMonthD = new Date(yearNum, monthIndex + 1, 1);
    const checkOut = `${nextMonthD.getFullYear()}-${String(nextMonthD.getMonth() + 1).padStart(2, '0')}-01`;
    const nights = new Date(yearNum, monthIndex + 1, 0).getDate();
    return { checkIn, checkOut, nights };
  };

  const handleAddBooking = () => {
    let initialDate = '';
    let initialCheckOut = '';
    let initialNights: number | '' = '';

    if (tableRateMode === 'monthly') {
      const fullMonth = getMonthDefaultDates(defaultMonthIndex, 2026);
      initialDate = fullMonth.checkIn;
      initialCheckOut = fullMonth.checkOut;
      initialNights = fullMonth.nights;
    }

    const newBooking: BookingItem = {
      id: generateId(),
      date: initialDate,
      checkOutDate: initialCheckOut,
      unit: 'Unit 1',
      guestName: '',
      nights: initialNights,
      nightlyRate: '',
      monthlyRate: '',
      rateMode: tableRateMode,
      discount: '',
      discountType: 'amount',
      discountValue: '',
      discountBy: '',
      netPayout: '',
      status: 'Confirmed',
      notes: '',
    };
    onChange([...items, newBooking]);
    // Set active calendar booking to allow immediate date picking
    setActiveCalendarBooking(newBooking);
    setActiveCalendarAnchor(null);
  };

  const handleOpenCalendar = (booking: BookingItem, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveCalendarAnchor(rect);
    setActiveCalendarBooking(booking);
  };

  const handleApplyCalendarDates = (
    bookingId: string,
    checkIn: string,
    checkOut: string,
    nights: number
  ) => {
    const updated = items.map((item) => {
      if (item.id !== bookingId) return item;
      const next: BookingItem = {
        ...item,
        date: checkIn,
        checkOutDate: checkOut,
        nights: nights,
      };

      const isShareholderDisc = isShareholderDiscount(next.discountBy, partnerList);
      const discPerNight = parseAmount(next.discount);
      const effectiveDisc = isShareholderDisc ? 0 : discPerNight;
      const n = nights > 0 ? nights : 1;
      const effectiveNights = n >= 28 ? n : 30;

      const currentMode = next.rateMode || tableRateMode;
      if (currentMode === 'monthly' && next.monthlyRate !== '' && next.monthlyRate !== undefined) {
        const m = parseAmount(next.monthlyRate);
        const r = Math.round((m / effectiveNights) * 100) / 100;
        next.nightlyRate = r;
        if (n >= 28) {
          next.netPayout = Math.max(0, m - (effectiveDisc * n));
        } else {
          next.netPayout = Math.max(0, ((m / 30) - effectiveDisc) * n);
        }
      } else if (next.nightlyRate !== '' && next.nightlyRate !== undefined) {
        const rate = parseAmount(next.nightlyRate);
        next.netPayout = Math.max(0, (rate - effectiveDisc) * n);
        next.monthlyRate = Math.round((rate * effectiveNights) * 100) / 100;
      } else if (next.netPayout !== '' && next.netPayout !== undefined && n > 0) {
        const net = parseAmount(next.netPayout);
        const r = Math.round(((net / n) + effectiveDisc) * 100) / 100;
        next.nightlyRate = r;
        next.monthlyRate = Math.round((r * effectiveNights) * 100) / 100;
      }

      return next;
    });
    onChange(updated);
  };

  const handleSetTableRateMode = (mode: 'nightly' | 'monthly') => {
    setTableRateMode(mode);
    const fullMonth = getMonthDefaultDates(defaultMonthIndex, 2026);

    const updated = items.map((item) => {
      let itemDate = item.date;
      let itemCheckOut = item.checkOutDate;
      let itemNights = item.nights;

      if (mode === 'monthly' && (!itemDate || !itemCheckOut || itemNights === '' || itemNights === 1)) {
        itemDate = fullMonth.checkIn;
        itemCheckOut = fullMonth.checkOut;
        itemNights = fullMonth.nights;
      }

      const n = typeof itemNights === 'number' && itemNights > 0 ? itemNights : parseAmount(itemNights) || 1;
      const effectiveNights = n >= 28 ? n : 30;
      let nightly = item.nightlyRate;
      let monthly = item.monthlyRate;

      if (mode === 'monthly') {
        if ((monthly === '' || monthly === undefined) && nightly !== '' && nightly !== undefined) {
          monthly = Math.round((parseAmount(nightly) * effectiveNights) * 100) / 100;
        }
      } else {
        if ((nightly === '' || nightly === undefined) && monthly !== '' && monthly !== undefined) {
          nightly = Math.round((parseAmount(monthly) / effectiveNights) * 100) / 100;
        }
      }

      return {
        ...item,
        date: itemDate,
        checkOutDate: itemCheckOut,
        nights: itemNights,
        rateMode: mode,
        nightlyRate: nightly,
        monthlyRate: monthly,
      };
    });
    onChange(updated);
  };

  const handleToggleRowRateMode = (id: string) => {
    const fullMonth = getMonthDefaultDates(defaultMonthIndex, 2026);

    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const currentMode = item.rateMode || tableRateMode;
      const nextMode: 'nightly' | 'monthly' = currentMode === 'monthly' ? 'nightly' : 'monthly';

      let itemDate = item.date;
      let itemCheckOut = item.checkOutDate;
      let itemNights = item.nights;

      if (nextMode === 'monthly' && (!itemDate || !itemCheckOut || itemNights === '' || itemNights === 1)) {
        itemDate = fullMonth.checkIn;
        itemCheckOut = fullMonth.checkOut;
        itemNights = fullMonth.nights;
      }

      const n = typeof itemNights === 'number' && itemNights > 0 ? itemNights : parseAmount(itemNights) || 1;
      const effectiveNights = n >= 28 ? n : 30;

      let nightly = item.nightlyRate;
      let monthly = item.monthlyRate;

      if (nextMode === 'monthly' && (monthly === '' || monthly === undefined)) {
        if (nightly !== '' && nightly !== undefined) {
          monthly = Math.round((parseAmount(nightly) * effectiveNights) * 100) / 100;
        }
      } else if (nextMode === 'nightly' && (nightly === '' || nightly === undefined)) {
        if (monthly !== '' && monthly !== undefined) {
          nightly = Math.round((parseAmount(monthly) / effectiveNights) * 100) / 100;
        }
      }

      return {
        ...item,
        date: itemDate,
        checkOutDate: itemCheckOut,
        nights: itemNights,
        rateMode: nextMode,
        nightlyRate: nightly,
        monthlyRate: monthly,
      };
    });
    onChange(updated);
  };

  const handleToggleDiscountType = (id: string) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const isCurrentlyPercent = item.discountType === 'percent';
      const nextType: 'amount' | 'percent' = isCurrentlyPercent ? 'amount' : 'percent';

      const rate = parseAmount(item.nightlyRate);
      const discAmt = parseAmount(item.discount);
      let nextValue: number | '' = '';

      if (nextType === 'percent') {
        if (rate > 0 && discAmt > 0) {
          nextValue = Math.round((discAmt / rate) * 10000) / 100;
        } else if (typeof item.discountValue === 'number' && item.discountValue > 0) {
          nextValue = item.discountValue;
        }
      }

      return {
        ...item,
        discountType: nextType,
        discountValue: nextValue,
      };
    });
    onChange(updated);
  };

  const handleDiscountPercentChange = (id: string, rawVal: string) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;

      const n = typeof item.nights === 'number' ? item.nights : parseAmount(item.nights);
      const validNights = n > 0 ? n : 1;
      const rate = parseAmount(item.nightlyRate);
      const isShareholderDisc = isShareholderDiscount(item.discountBy, partnerList);

      if (rawVal === '') {
        const next: BookingItem = {
          ...item,
          discountType: 'percent',
          discountValue: '',
          discount: 0,
        };
        if (rate > 0) {
          next.netPayout = Math.max(0, rate * validNights);
        }
        return next;
      }

      const pct = parseFloat(rawVal);
      const validPct = isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
      const next: BookingItem = {
        ...item,
        discountType: 'percent',
        discountValue: isNaN(pct) ? '' : validPct,
      };

      if (rate > 0) {
        const discAmt = Math.round(((rate * validPct) / 100) * 100) / 100;
        next.discount = discAmt;
        const effDiscAmt = isShareholderDisc ? 0 : discAmt;
        next.netPayout = Math.max(0, (rate - effDiscAmt) * validNights);
      } else if (item.netPayout !== '' && item.netPayout !== undefined && validPct < 100) {
        const net = parseAmount(item.netPayout);
        const netPerNight = net / validNights;
        const calcRate = Math.round((netPerNight / (1 - validPct / 100)) * 100) / 100;
        const discAmt = Math.round((calcRate - netPerNight) * 100) / 100;
        next.nightlyRate = calcRate;
        next.discount = discAmt;
      }

      return next;
    });
    onChange(updated);
  };

  const handleUpdateRow = (id: string, field: keyof BookingItem, value: any) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;

      const next = { ...item, [field]: value };

      const n = typeof next.nights === 'number' ? next.nights : parseAmount(next.nights);
      const validNights = n > 0 ? n : 1;
      const effectiveNights = validNights >= 28 ? validNights : 30;
      const discountPerNight = parseAmount(next.discount);
      const isShareholderDisc = isShareholderDiscount(field === 'discountBy' ? value : next.discountBy, partnerList);
      const effectiveDiscountPerNight = isShareholderDisc ? 0 : discountPerNight;

      // Reactive calculations for Nightly Rate, Monthly Rate, Discount (₱/nt), and Net Payout
      if (field === 'discountBy') {
        const currentMode = next.rateMode || tableRateMode;
        if (currentMode === 'monthly' && next.monthlyRate !== '' && next.monthlyRate !== undefined) {
          const m = parseAmount(next.monthlyRate);
          if (validNights >= 28) {
            next.netPayout = Math.max(0, m - (effectiveDiscountPerNight * validNights));
          } else {
            next.netPayout = Math.max(0, ((m / 30) - effectiveDiscountPerNight) * validNights);
          }
        } else if (next.nightlyRate !== '' && next.nightlyRate !== undefined) {
          const rate = parseAmount(next.nightlyRate);
          next.netPayout = Math.max(0, (rate - effectiveDiscountPerNight) * validNights);
        }
      } else if (field === 'monthlyRate') {
        const mRate = value === '' ? '' : parseAmount(value);
        next.monthlyRate = mRate;
        next.rateMode = 'monthly';
        if (mRate !== '') {
          const nightly = Math.round((mRate / effectiveNights) * 100) / 100;
          next.nightlyRate = nightly;
          if (validNights >= 28) {
            next.netPayout = Math.max(0, mRate - (effectiveDiscountPerNight * validNights));
          } else {
            next.netPayout = Math.max(0, ((mRate / 30) - effectiveDiscountPerNight) * validNights);
          }
        }
      } else if (field === 'nightlyRate') {
        const rate = value === '' ? '' : parseAmount(value);
        next.nightlyRate = rate;
        next.rateMode = 'nightly';
        if (rate !== '') {
          next.monthlyRate = Math.round((rate * effectiveNights) * 100) / 100;
          if (next.discountType === 'percent' && typeof next.discountValue === 'number' && next.discountValue > 0) {
            const discAmt = Math.round(((rate * next.discountValue) / 100) * 100) / 100;
            next.discount = discAmt;
            const effDiscAmt = isShareholderDisc ? 0 : discAmt;
            next.netPayout = Math.max(0, (rate - effDiscAmt) * validNights);
          } else {
            next.netPayout = Math.max(0, (rate - effectiveDiscountPerNight) * validNights);
          }
        }
      } else if (field === 'netPayout') {
        const net = value === '' ? '' : parseAmount(value);
        next.netPayout = net;
        if (net !== '' && n > 0) {
          if (next.discountType === 'percent' && typeof next.discountValue === 'number' && next.discountValue < 100) {
            const netPerNight = net / validNights;
            const calcRate = Math.round((netPerNight / (1 - next.discountValue / 100)) * 100) / 100;
            next.nightlyRate = calcRate;
            next.discount = Math.round((calcRate - netPerNight) * 100) / 100;
            next.monthlyRate = Math.round((calcRate * effectiveNights) * 100) / 100;
          } else {
            const calcRate = Math.round(((net / validNights) + effectiveDiscountPerNight) * 100) / 100;
            next.nightlyRate = calcRate;
            next.monthlyRate = Math.round((calcRate * effectiveNights) * 100) / 100;
          }
        }
      } else if (field === 'discount') {
        // Fixed amount discount is per night (₱/nt)
        const disc = value === '' ? '' : parseAmount(value);
        next.discount = disc;
        next.discountType = 'amount';
        next.discountValue = '';
        const effDisc = isShareholderDisc ? 0 : parseAmount(disc);
        const currentMode = next.rateMode || tableRateMode;
        if (currentMode === 'monthly' && next.monthlyRate !== '' && next.monthlyRate !== undefined) {
          const m = parseAmount(next.monthlyRate);
          if (validNights >= 28) {
            next.netPayout = Math.max(0, m - (effDisc * validNights));
          } else {
            next.netPayout = Math.max(0, ((m / 30) - effDisc) * validNights);
          }
        } else if (next.nightlyRate !== '' && next.nightlyRate !== undefined) {
          const rate = parseAmount(next.nightlyRate);
          next.netPayout = Math.max(0, (rate - effDisc) * validNights);
        } else if (next.netPayout !== '' && next.netPayout !== undefined && n > 0) {
          const net = parseAmount(next.netPayout);
          const r = Math.round(((net / validNights) + effDisc) * 100) / 100;
          next.nightlyRate = r;
          next.monthlyRate = Math.round((r * effectiveNights) * 100) / 100;
        }
      } else if (field === 'nights') {
        const newNights = value === '' ? '' : parseInt(value) || 0;
        next.nights = newNights;
        const validNewNights = (typeof newNights === 'number' && newNights > 0) ? newNights : 1;
        const newEffectiveNights = validNewNights >= 28 ? validNewNights : 30;

        const currentMode = next.rateMode || tableRateMode;
        if (currentMode === 'monthly' && next.monthlyRate !== '' && next.monthlyRate !== undefined) {
          const m = parseAmount(next.monthlyRate);
          if (validNewNights >= 28) {
            next.netPayout = Math.max(0, m - (effectiveDiscountPerNight * validNewNights));
            next.nightlyRate = Math.round((m / validNewNights) * 100) / 100;
          } else {
            next.netPayout = Math.max(0, ((m / 30) - effectiveDiscountPerNight) * validNewNights);
            next.nightlyRate = Math.round((m / 30) * 100) / 100;
          }
        } else if (next.nightlyRate !== '' && next.nightlyRate !== undefined) {
          const rate = parseAmount(next.nightlyRate);
          next.netPayout = Math.max(0, (rate - effectiveDiscountPerNight) * validNewNights);
          next.monthlyRate = Math.round((rate * newEffectiveNights) * 100) / 100;
        } else if (next.netPayout !== '' && next.netPayout !== undefined && typeof newNights === 'number' && newNights > 0) {
          const net = parseAmount(next.netPayout);
          if (next.discountType === 'percent' && typeof next.discountValue === 'number' && next.discountValue < 100) {
            const netPerNight = net / validNewNights;
            const calcRate = Math.round((netPerNight / (1 - next.discountValue / 100)) * 100) / 100;
            next.nightlyRate = calcRate;
            next.discount = Math.round((calcRate - netPerNight) * 100) / 100;
            next.monthlyRate = Math.round((calcRate * newEffectiveNights) * 100) / 100;
          } else {
            const r = Math.round(((net / newNights) + effectiveDiscountPerNight) * 100) / 100;
            next.nightlyRate = r;
            next.monthlyRate = Math.round((r * newEffectiveNights) * 100) / 100;
          }
        }
      }

      return next;
    });
    onChange(updated);
  };

  const handleDeleteRow = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  // Automated totals
  let totalNights = 0;
  let totalDiscounts = 0;
  let totalShareholderDiscounts = 0;
  let totalAirbnbDiscounts = 0;
  let totalNet = 0;
  let totalNightlyRateSum = 0;
  let totalMonthlyRateSum = 0;
  let rateCount = 0;

  items.forEach((item) => {
    const n = typeof item.nights === 'number' ? item.nights : parseAmount(item.nights);
    if (n > 0) totalNights += n;

    const discountPerNight = parseAmount(item.discount);
    const bookingTotalDiscount = discountPerNight * (n > 0 ? n : 1);
    totalDiscounts += bookingTotalDiscount;

    const isShareholderDisc = isShareholderDiscount(item.discountBy, partnerList);
    if (bookingTotalDiscount > 0) {
      if (isShareholderDisc) {
        totalShareholderDiscounts += bookingTotalDiscount;
      } else {
        totalAirbnbDiscounts += bookingTotalDiscount;
      }
    }

    let net = 0;
    if (isShareholderDisc) {
      if (item.rateMode === 'monthly' && item.monthlyRate !== '' && item.monthlyRate !== undefined) {
        const m = parseAmount(item.monthlyRate);
        net = n >= 28 ? m : (m / 30) * (n > 0 ? n : 1);
      } else if (item.nightlyRate !== '' && item.nightlyRate !== undefined && n > 0) {
        net = parseAmount(item.nightlyRate) * n;
      } else if (item.grossPayout !== '' && item.grossPayout !== undefined) {
        net = Math.max(0, parseAmount(item.grossPayout) - parseAmount(item.platformFee));
      } else if (item.netPayout !== '' && item.netPayout !== undefined) {
        net = parseAmount(item.netPayout);
      }
    } else {
      if (item.netPayout !== '' && item.netPayout !== undefined) {
        net = parseAmount(item.netPayout);
      } else if (item.rateMode === 'monthly' && item.monthlyRate !== '' && item.monthlyRate !== undefined) {
        const m = parseAmount(item.monthlyRate);
        net = n >= 28 ? Math.max(0, m - bookingTotalDiscount) : Math.max(0, (m / 30 - discountPerNight) * (n > 0 ? n : 1));
      } else if (item.nightlyRate !== '' && item.nightlyRate !== undefined && n > 0) {
        net = Math.max(0, (parseAmount(item.nightlyRate) - discountPerNight) * n);
      } else if (item.grossPayout !== '' && item.grossPayout !== undefined) {
        net = Math.max(0, parseAmount(item.grossPayout) - parseAmount(item.platformFee) - bookingTotalDiscount);
      }
    }
    totalNet += net;

    const nightly =
      item.nightlyRate !== '' && item.nightlyRate !== undefined
        ? parseAmount(item.nightlyRate)
        : item.monthlyRate !== '' && item.monthlyRate !== undefined
        ? parseAmount(item.monthlyRate) / (n >= 28 ? n : 30)
        : n > 0 && net > 0
        ? (net / n) + discountPerNight
        : 0;

    const monthly =
      item.monthlyRate !== '' && item.monthlyRate !== undefined
        ? parseAmount(item.monthlyRate)
        : nightly > 0
        ? nightly * (n >= 28 ? n : 30)
        : 0;

    if (nightly > 0) {
      totalNightlyRateSum += nightly;
      totalMonthlyRateSum += monthly;
      rateCount++;
    }
  });

  const avgNightlyRate = rateCount > 0 ? totalNightlyRateSum / rateCount : 0;
  const avgMonthlyRate = rateCount > 0 ? totalMonthlyRateSum / rateCount : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col mb-4">
      {/* Table Header with Quick Stats & Upper Right Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
          <h2 className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
            Bookings Ledger
          </h2>
          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] font-mono">
            {items.length} {items.length === 1 ? 'booking' : 'bookings'}
          </span>
          {totalNights > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-800/70 text-sky-300 text-[10px] font-mono">
              {totalNights} nights total
            </span>
          )}
          {isMinimized && (
            <span className="text-[10px] font-mono text-neutral-400 ml-1">
              • Net:{' '}
              <span className="text-sky-300 font-semibold">{formatPHP(totalNet)}</span>
            </span>
          )}
        </div>

        {/* Upper Right Corner Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            id={`add-booking-btn-${monthId}`}
            onClick={() => {
              if (isMinimized) setIsMinimized(false);
              handleAddBooking();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-sky-300 bg-sky-950/60 border border-sky-800/60 rounded hover:bg-sky-900/60 hover:text-sky-200 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Booking</span>
          </button>

          {/* Minimize / Expand */}
          <button
            type="button"
            id={`minimize-bookings-btn-${monthId}`}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand Bookings Ledger' : 'Minimize Bookings Ledger'}
            aria-label={isMinimized ? 'Expand Bookings Ledger' : 'Minimize Bookings Ledger'}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors focus:outline-none"
          >
            {isMinimized ? (
              <ChevronDown className="w-4 h-4 text-sky-400" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Responsive Compact Table (hidden when minimized) */}
      {!isMinimized && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-950/90 text-neutral-400 border-b border-neutral-800 text-[11px] font-medium select-none">
                {/* 1. DATE, NIGHTS & UNIT COMBINED */}
                <th className="py-2 px-2.5 min-w-[260px]">DATE & UNIT</th>

                {/* 2. GUEST NAME */}
                <th className="py-2 px-2.5 min-w-[130px]">GUEST NAME</th>

                {/* 3. RATE (Nightly vs Monthly toggle in Header) */}
                <th className="py-1.5 px-2 min-w-[155px] text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Mode Switcher Pill */}
                    <div className="inline-flex items-center bg-neutral-900 border border-neutral-700/80 rounded p-0.5 text-[10px]">
                      <button
                        type="button"
                        id={`rate-mode-nightly-${monthId}`}
                        onClick={() => handleSetTableRateMode('nightly')}
                        className={`px-1.5 py-0.5 rounded transition-all font-medium flex items-center gap-1 ${
                          tableRateMode === 'nightly'
                            ? 'bg-sky-950 text-sky-300 border border-sky-700/80 shadow-xs'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Switch column to Nightly Rate (₱/night)"
                      >
                        <span>Nightly</span>
                      </button>
                      <button
                        type="button"
                        id={`rate-mode-monthly-${monthId}`}
                        onClick={() => handleSetTableRateMode('monthly')}
                        className={`px-1.5 py-0.5 rounded transition-all font-medium flex items-center gap-1 ${
                          tableRateMode === 'monthly'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-xs'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Switch column to Monthly Rate (₱/month)"
                      >
                        <span>Monthly</span>
                      </button>
                    </div>
                    <span className="uppercase tracking-wider font-semibold text-[10px] text-neutral-300 whitespace-nowrap">
                      RATE
                    </span>
                  </div>
                </th>

                {/* 4. DISCOUNT */}
                <th className="py-2 px-2 min-w-[280px]">DISCOUNT</th>

                {/* 5. NET PAYOUT */}
                <th className="py-2 px-2 w-32 text-right text-sky-300">NET PAYOUT (₱)</th>

                {/* 6. STATUS */}
                <th className="py-2 px-2 w-24">STATUS</th>

                {/* 7. NOTES */}
                <th className="py-2 px-2.5 min-w-[110px]">NOTES</th>

                {/* Action */}
                <th className="py-2 px-1 w-8 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center gap-1.5 text-xs">
                      <BedDouble className="w-5 h-5 text-neutral-600" />
                      <span>No bookings recorded for this month.</span>
                      <button
                        type="button"
                        onClick={handleAddBooking}
                        className="text-sky-400 hover:text-sky-300 underline underline-offset-2 text-[11px] mt-0.5"
                      >
                        Click here to add your first booking
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const n =
                    typeof item.nights === 'number'
                      ? item.nights
                      : parseAmount(item.nights);
                  const validNights = n > 0 ? n : 1;
                  const effectiveNights = validNights >= 28 ? validNights : 30;
                  const discountPerNight = parseAmount(item.discount);

                  const rowRateMode = item.rateMode || tableRateMode;

                  // Calculated effective nightly rate and monthly rate
                  let calculatedNightly = 0;
                  let calculatedMonthly = 0;

                  if (item.nightlyRate !== '' && item.nightlyRate !== undefined) {
                    calculatedNightly = parseAmount(item.nightlyRate);
                    calculatedMonthly =
                      item.monthlyRate !== '' && item.monthlyRate !== undefined
                        ? parseAmount(item.monthlyRate)
                        : Math.round((calculatedNightly * effectiveNights) * 100) / 100;
                  } else if (item.monthlyRate !== '' && item.monthlyRate !== undefined) {
                    calculatedMonthly = parseAmount(item.monthlyRate);
                    calculatedNightly = Math.round((calculatedMonthly / effectiveNights) * 100) / 100;
                  } else if (item.netPayout !== '' && item.netPayout !== undefined && n > 0) {
                    const net = parseAmount(item.netPayout);
                    calculatedNightly = Math.round(((net / validNights) + discountPerNight) * 100) / 100;
                    calculatedMonthly = Math.round((calculatedNightly * effectiveNights) * 100) / 100;
                  }

                  const displayRateValue =
                    rowRateMode === 'monthly'
                      ? (item.monthlyRate !== '' && item.monthlyRate !== undefined
                          ? item.monthlyRate
                          : calculatedMonthly > 0
                          ? calculatedMonthly
                          : '')
                      : (item.nightlyRate !== '' && item.nightlyRate !== undefined
                          ? item.nightlyRate
                          : calculatedNightly > 0
                          ? calculatedNightly
                          : '');

                  const isShareholderDisc = isShareholderDiscount(item.discountBy, partnerList);
                  const effectiveDiscForDisplay = isShareholderDisc ? 0 : discountPerNight;

                  const displayNet =
                    item.netPayout !== '' && item.netPayout !== undefined
                      ? item.netPayout
                      : rowRateMode === 'monthly' && calculatedMonthly > 0
                      ? validNights >= 28
                        ? Math.max(0, calculatedMonthly - (effectiveDiscForDisplay * validNights))
                        : Math.max(0, ((calculatedMonthly / 30) - effectiveDiscForDisplay) * validNights)
                      : calculatedNightly > 0 && n > 0
                      ? Math.max(0, (calculatedNightly - effectiveDiscForDisplay) * n)
                      : '';

                  const dateLabel = formatDateRange(item.date, item.checkOutDate);
                  const isConflict = hasBookingConflict(item, items);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-850/60 transition-colors group text-neutral-200 ${
                        isConflict ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      {/* 1. DATE, NIGHTS & UNIT (Merged into one compact line) */}
                      <td className="py-1.5 px-2 min-w-[260px]">
                        <div className="flex items-center gap-1.5">
                          {/* Date range trigger */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenCalendar(item, e)}
                            className={`flex-1 min-w-0 text-left flex items-center gap-1.5 px-2 py-1 rounded border transition-colors text-[11px] font-mono ${
                              isConflict
                                ? 'bg-rose-950/50 border-rose-700/80 text-rose-200 hover:border-rose-500'
                                : item.date
                                ? 'bg-neutral-950/80 border-neutral-700/80 hover:border-sky-500 text-neutral-200 hover:text-white'
                                : 'bg-sky-950/40 border-sky-800/60 text-sky-300 hover:bg-sky-900/40'
                            }`}
                            title={
                              isConflict
                                ? 'Warning: Dates conflict with another booking in this unit!'
                                : 'Click to select booking dates'
                            }
                          >
                            {isConflict ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate font-medium">{dateLabel}</span>
                          </button>

                          {/* Unit select */}
                          <select
                            aria-label={`Booking Unit row ${index + 1}`}
                            value={item.unit || item.channel || 'Unit 1'}
                            onChange={(e) => handleUpdateRow(item.id, 'unit', e.target.value)}
                            className="bg-neutral-950/80 border border-neutral-700/80 rounded px-1.5 py-1 text-[11px] font-medium text-neutral-200 focus:outline-none focus:border-sky-500 cursor-pointer hover:border-neutral-600 shrink-0"
                          >
                            {UNITS.map((u) => (
                              <option key={u} value={u} className="bg-neutral-900 text-neutral-200">
                                {u}
                              </option>
                            ))}
                          </select>

                          {/* Inline nights adjuster */}
                          <div
                            className="flex items-center bg-neutral-950/80 border border-neutral-700/80 rounded px-1.5 py-1 shrink-0"
                            title="Nights"
                          >
                            <input
                              type="number"
                              min="1"
                              aria-label={`Nights row ${index + 1}`}
                              placeholder="0"
                              value={item.nights}
                              onChange={(e) =>
                                handleUpdateRow(
                                  item.id,
                                  'nights',
                                  e.target.value === '' ? '' : parseInt(e.target.value) || 0
                                )
                              }
                              className="w-5 bg-transparent text-right font-mono-numbers text-[11px] text-sky-400 font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-neutral-400 font-mono text-[10px] ml-0.5">nts</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. GUEST NAME */}
                      <td className="py-1 px-1.5">
                        <input
                          type="text"
                          aria-label={`Guest Name row ${index + 1}`}
                          placeholder="e.g. John Doe"
                          value={item.guestName}
                          onChange={(e) => handleUpdateRow(item.id, 'guestName', e.target.value)}
                          className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-[11px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-neutral-900"
                        />
                      </td>

                      {/* 3. RATE (Nightly vs Monthly with unit switcher) */}
                      <td className="py-1 px-1.5 min-w-[155px]">
                        <div className="flex flex-col gap-0.5">
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 top-1 text-neutral-500 text-[10px] font-mono">
                              ₱
                            </span>
                            <FormattedAmountInput
                              aria-label={`${rowRateMode === 'monthly' ? 'Monthly' : 'Nightly'} Rate row ${index + 1}`}
                              placeholder="0.00"
                              value={displayRateValue}
                              onChange={(val) => {
                                if (rowRateMode === 'monthly') {
                                  handleUpdateRow(item.id, 'monthlyRate', val);
                                } else {
                                  handleUpdateRow(item.id, 'nightlyRate', val);
                                }
                              }}
                              className={`w-full pl-4 pr-11 py-1 bg-neutral-950/60 border rounded text-[11px] text-right font-mono-numbers text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:bg-neutral-900 ${
                                rowRateMode === 'monthly'
                                  ? 'border-emerald-900/70 focus:border-emerald-500 focus:ring-emerald-500'
                                  : 'border-neutral-800 focus:border-sky-500 focus:ring-sky-500'
                              }`}
                              title={`${rowRateMode === 'monthly' ? 'Monthly rate (₱/mo)' : 'Nightly rate (₱/nt)'}`}
                            />
                            {/* Per-row unit toggle badge */}
                            <button
                              type="button"
                              onClick={() => handleToggleRowRateMode(item.id)}
                              className={`absolute right-1 top-0.5 bottom-0.5 px-1 my-auto h-5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                                rowRateMode === 'monthly'
                                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900'
                                  : 'bg-sky-950/80 text-sky-300 border border-sky-800/70 hover:bg-sky-900'
                              }`}
                              title={
                                rowRateMode === 'monthly'
                                  ? 'Currently Monthly (₱/mo). Click to switch to Nightly rate (₱/nt)'
                                  : 'Currently Nightly (₱/nt). Click to switch to Monthly rate (₱/mo)'
                              }
                            >
                              {rowRateMode === 'monthly' ? '/mo' : '/nt'}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 4. DISCOUNT (Merged into one compact line) */}
                      <td className="py-1 px-1.5 min-w-[260px]">
                        {(() => {
                          const rowTotalDiscount = discountPerNight * validNights;
                          const hasDiscount = rowTotalDiscount > 0 || (typeof item.discount === 'number' && item.discount > 0);
                          const isPercent = item.discountType === 'percent';
                          const pctVal = typeof item.discountValue === 'number' ? item.discountValue : parseFloat(item.discountValue || '0') || 0;
                          
                          const rowTooltip = isPercent && pctVal > 0
                            ? `${pctVal}% discount on ₱${calculatedNightly > 0 ? calculatedNightly.toLocaleString() : '0'}/nt = ₱${discountPerNight.toLocaleString()}/nt × ${validNights} nts = ₱${rowTotalDiscount.toLocaleString()} total discount${item.discountBy ? ` (${isShareholderDisc ? `Shareholder: ${item.discountBy} - Repayable` : `Channel: ${item.discountBy}`})` : ''}`
                            : discountPerNight > 0
                            ? `${validNights} nts × ₱${discountPerNight.toLocaleString()}/nt = ₱${rowTotalDiscount.toLocaleString()} total discount${item.discountBy ? ` (${isShareholderDisc ? `Shareholder: ${item.discountBy} - Repayable` : `Channel: ${item.discountBy}`})` : ''}`
                            : 'No discount applied';

                          return (
                            <div
                              id={`discount-cell-${item.id}`}
                              className={`flex items-center rounded px-1 py-0.5 w-full transition-colors ${
                                hasDiscount
                                  ? isShareholderDisc
                                    ? 'bg-amber-950/25 border border-amber-800/70 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/50'
                                    : 'bg-sky-950/25 border border-sky-800/70 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/50'
                                  : 'bg-neutral-950/70 border border-neutral-800 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/50'
                              }`}
                              title={rowTooltip}
                            >
                              {/* Type Toggle: ₱ or % */}
                              <button
                                type="button"
                                onClick={() => handleToggleDiscountType(item.id)}
                                title={
                                  isPercent
                                    ? 'Switch to fixed discount in PHP (₱/night)'
                                    : 'Switch to percentage discount (%)'
                                }
                                className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold transition-colors shrink-0 ${
                                  isPercent
                                    ? isShareholderDisc
                                      ? 'bg-amber-950/90 text-amber-300 border border-amber-700/80 hover:bg-amber-900/90'
                                      : 'bg-sky-950/90 text-sky-300 border border-sky-700/80 hover:bg-sky-900/90'
                                    : 'bg-neutral-900 text-neutral-400 border border-neutral-700/60 hover:text-neutral-200'
                                }`}
                              >
                                {isPercent ? '%' : '₱'}
                              </button>

                              {/* Discount Value Input */}
                              <div className="relative w-12 shrink-0 ml-1">
                                {isPercent ? (
                                  <div className="relative flex items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="any"
                                      aria-label={`Discount percentage row ${index + 1}`}
                                      placeholder="0"
                                      value={
                                        item.discountValue !== undefined && item.discountValue !== ''
                                          ? item.discountValue
                                          : ''
                                      }
                                      onChange={(e) =>
                                        handleDiscountPercentChange(item.id, e.target.value)
                                      }
                                      className={`w-full pr-3 bg-transparent text-[11px] text-right font-mono-numbers placeholder-neutral-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                        isShareholderDisc ? 'text-amber-300 font-semibold' : hasDiscount ? 'text-sky-300 font-semibold' : 'text-neutral-200'
                                      }`}
                                    />
                                    <span className="absolute right-0 text-neutral-500 text-[10px] font-mono pointer-events-none">%</span>
                                  </div>
                                ) : (
                                  <FormattedAmountInput
                                    aria-label={`Discount row ${index + 1}`}
                                    placeholder="0.00"
                                    value={item.discount ?? ''}
                                    onChange={(val) =>
                                      handleUpdateRow(item.id, 'discount', val)
                                    }
                                    className={`w-full bg-transparent text-[11px] text-right font-mono-numbers placeholder-neutral-600 focus:outline-none ${
                                      isShareholderDisc ? 'text-amber-300 font-semibold' : hasDiscount ? 'text-sky-300 font-semibold' : 'text-neutral-200'
                                    }`}
                                  />
                                )}
                              </div>

                              {/* Calculations & Row Total (Amber for Shareholders vs Sky Blue for Airbnb) */}
                              {hasDiscount && (
                                <div className="flex items-center gap-1 border-l border-neutral-800/80 pl-1.5 ml-1 min-w-0">
                                  <span className={`text-[10px] font-mono truncate shrink-0 ${isShareholderDisc ? 'text-amber-400/80' : 'text-sky-400/80'}`}>
                                    ({validNights} nts × ₱{discountPerNight.toLocaleString()}/nt)
                                  </span>
                                  <span className={`text-[11px] font-mono font-bold whitespace-nowrap shrink-0 ${isShareholderDisc ? 'text-amber-300' : 'text-sky-300'}`}>
                                    {rowTotalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}

                              {/* Merged Partner / Platform Dropdown */}
                              <select
                                aria-label={`Discount source row ${index + 1}`}
                                value={item.discountBy || ''}
                                onChange={(e) =>
                                  handleUpdateRow(item.id, 'discountBy', e.target.value)
                                }
                                className={`border-0 border-l border-neutral-800/80 pl-1.5 pr-0.5 py-0 text-[10px] focus:outline-none cursor-pointer shrink-0 ml-auto w-16 truncate ${
                                  isShareholderDisc
                                    ? 'bg-amber-950/60 text-amber-300 font-semibold'
                                    : item.discountBy === 'Airbnb' || item.discountBy === 'Booking'
                                    ? 'bg-sky-950/60 text-sky-300 font-semibold'
                                    : 'bg-transparent text-neutral-400 hover:text-neutral-200'
                                }`}
                              >
                                <option value="" className="bg-neutral-900 text-neutral-500">
                                  —
                                </option>
                                {partnerList.map((p) => (
                                  <option key={p.id || p.name} value={p.name} className="bg-neutral-900 text-amber-300 font-semibold">
                                    {p.name} (Partner)
                                  </option>
                                ))}
                                <option value="Airbnb" className="bg-neutral-900 text-sky-300 font-semibold">
                                  Airbnb
                                </option>
                                <option value="Booking" className="bg-neutral-900 text-sky-300 font-semibold">
                                  Booking
                                </option>
                              </select>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 5. NET PAYOUT */}
                      <td className="py-1 px-1.5">
                        <div className="relative">
                          <span className="absolute left-1.5 top-1 text-sky-400 text-[10px] font-mono font-bold">
                            ₱
                          </span>
                          <FormattedAmountInput
                            aria-label={`Net Payout row ${index + 1}`}
                            placeholder="0.00"
                            value={displayNet}
                            onChange={(val) =>
                              handleUpdateRow(item.id, 'netPayout', val)
                            }
                            className="w-full pl-4 pr-1.5 py-1 bg-sky-950/25 border border-sky-900/60 rounded text-[11px] text-right font-mono-numbers text-sky-300 font-semibold placeholder-neutral-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:bg-neutral-900"
                            title="Total net payout received"
                          />
                        </div>
                      </td>

                      {/* 6. STATUS */}
                      <td className="py-1 px-1.5">
                        <select
                          aria-label={`Status row ${index + 1}`}
                          value={item.status}
                          onChange={(e) => handleUpdateRow(item.id, 'status', e.target.value)}
                          className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-1.5 py-1 text-[10px] text-neutral-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-neutral-900 cursor-pointer"
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st} className="bg-neutral-900 text-neutral-200">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 7. NOTES */}
                      <td className="py-1 px-1.5">
                        <input
                          type="text"
                          aria-label={`Notes row ${index + 1}`}
                          placeholder="Remarks / Platform"
                          value={item.notes}
                          onChange={(e) => handleUpdateRow(item.id, 'notes', e.target.value)}
                          className="w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 py-1 text-[11px] text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:bg-neutral-900"
                        />
                      </td>

                      {/* Action */}
                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(item.id)}
                          aria-label="Delete row"
                          className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors opacity-70 group-hover:opacity-100"
                          title="Delete booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Automated Totals Row */}
            {items.length > 0 && (() => {
              const activeDiscountRows = items
                .map((item) => {
                  const n = typeof item.nights === 'number' && item.nights > 0 ? item.nights : parseAmount(item.nights) || 1;
                  const discPerNight = parseAmount(item.discount);
                  const rowTotal = discPerNight * n;
                  if (rowTotal <= 0) return null;
                  return {
                    guest: item.guestName || 'Guest',
                    nights: n,
                    discPerNight,
                    rowTotal,
                    by: item.discountBy,
                    pct: item.discountType === 'percent' && item.discountValue ? `${item.discountValue}%` : null,
                  };
                })
                .filter(Boolean);

              const footerDiscountTooltip =
                activeDiscountRows.length > 0
                  ? activeDiscountRows
                      .map(
                        (d) =>
                          `${d!.guest}${d!.by ? ` (${d!.by})` : ''}: ${d!.nights} nts × ₱${d!.discPerNight.toLocaleString()}/nt = ₱${d!.rowTotal.toLocaleString()}`
                      )
                      .join(' + ') +
                    ` = ${formatPHP(totalDiscounts)} total discount (Shareholders: ${formatPHP(totalShareholderDiscounts)} | Airbnb/Channel: ${formatPHP(totalAirbnbDiscounts)})`
                  : 'No discounts applied';

              return (
                <tfoot>
                  <tr className="bg-neutral-950 font-semibold text-neutral-200 border-t-2 border-neutral-800 text-[11px]">
                    <td className="py-2 px-2.5 text-neutral-400 text-[10px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold uppercase tracking-wider text-neutral-300">Total</span>
                        <span className="font-mono text-sky-300 font-semibold">({totalNights} nts)</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-neutral-400 font-mono text-[10px] whitespace-nowrap">
                      {items.length} {items.length === 1 ? 'booking' : 'bookings'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono-numbers text-neutral-300 whitespace-nowrap">
                      {tableRateMode === 'monthly' ? (
                        avgMonthlyRate > 0 ? (
                          <div title={`Average Monthly Rate across ${rateCount} booking(s)`}>
                            <span>{formatPHP(avgMonthlyRate)}</span>
                            <span className="text-[10px] text-emerald-400 font-mono ml-0.5">/mo</span>
                          </div>
                        ) : (
                          '—'
                        )
                      ) : (
                        avgNightlyRate > 0 ? (
                          <div title={`Average Nightly Rate across ${rateCount} booking(s)`}>
                            <span>{formatPHP(avgNightlyRate)}</span>
                            <span className="text-[10px] text-sky-400 font-mono ml-0.5">/nt</span>
                          </div>
                        ) : (
                          '—'
                        )
                      )}
                    </td>
                    <td
                      className="py-2 px-2 text-right font-mono-numbers cursor-default whitespace-nowrap"
                      title={footerDiscountTooltip}
                    >
                      {totalDiscounts > 0 ? (
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap whitespace-nowrap">
                          <span className="text-neutral-100 font-bold text-xs">{formatPHP(totalDiscounts)}</span>
                          <span className="text-[10px] font-mono flex items-center gap-1">
                            <span className="text-neutral-500 font-normal">(</span>
                            {totalShareholderDiscounts > 0 && (
                              <span className="text-amber-400 font-semibold" title="Shareholder Discounts (Repayable)">
                                Sh: {formatPHP(totalShareholderDiscounts)}
                              </span>
                            )}
                            {totalShareholderDiscounts > 0 && totalAirbnbDiscounts > 0 && (
                              <span className="text-neutral-600 font-normal">|</span>
                            )}
                            {totalAirbnbDiscounts > 0 && (
                              <span className="text-sky-400 font-semibold" title="Airbnb / OTA Platform Discounts (Deducted)">
                                OTA: {formatPHP(totalAirbnbDiscounts)}
                              </span>
                            )}
                            <span className="text-neutral-500 font-normal">)</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-500 font-normal">₱0.00</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono-numbers text-sky-300 text-xs font-bold whitespace-nowrap">
                      {formatPHP(totalNet)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      )}

      {/* 1. Modal for Editing/Setting Active Booking Dates */}
      {activeCalendarBooking && (
        <BookingCalendarModal
          isOpen={Boolean(activeCalendarBooking)}
          onClose={() => {
            setActiveCalendarBooking(null);
            setActiveCalendarAnchor(null);
          }}
          checkIn={activeCalendarBooking.date}
          checkOut={activeCalendarBooking.checkOutDate}
          guestName={activeCalendarBooking.guestName}
          unit={activeCalendarBooking.unit || 'Unit 1'}
          onUnitChange={(newUnit) => {
            handleUpdateRow(activeCalendarBooking.id, 'unit', newUnit);
            setActiveCalendarBooking((prev) => (prev ? { ...prev, unit: newUnit } : null));
          }}
          currentBookingId={activeCalendarBooking.id}
          allBookings={allYearBookings || items}
          anchorRect={activeCalendarAnchor}
          defaultYear={2026}
          defaultMonth={defaultMonthIndex}
          rateMode={activeCalendarBooking.rateMode || tableRateMode}
          onApply={(checkIn, checkOut, nights) => {
            handleApplyCalendarDates(activeCalendarBooking.id, checkIn, checkOut, nights);
            setActiveCalendarBooking(null);
            setActiveCalendarAnchor(null);
          }}
        />
      )}
    </div>
  );
};
