import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Clock,
  ArrowRight,
  User,
} from 'lucide-react';
import { BookingItem } from '../types';

export interface BookingCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkIn: string; // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
  guestName?: string;
  unit: string;
  onUnitChange?: (unit: string) => void;
  currentBookingId?: string;
  allBookings?: BookingItem[];
  onApply: (checkIn: string, checkOut: string, nights: number) => void;
  defaultYear?: number;
  defaultMonth?: number; // 0-indexed (0 = Jan, 11 = Dec)
  anchorRect?: DOMRect | null;
  rateMode?: 'nightly' | 'monthly';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const PRESETS = [
  { label: '1 Nt', nights: 1 },
  { label: '2 Nts', nights: 2 },
  { label: '3 Nts', nights: 3 },
  { label: '5 Nts', nights: 5 },
  { label: '7 Nts', nights: 7 },
  { label: '14 Nts', nights: 14 },
  { label: '1 Mo (Full)', nights: -1 },
];

const UNITS = ['Unit 1', 'Unit 2', 'Unit 3'];

// Distinct rich themes modeled after hospitality calendar visualization
export const BOOKING_THEMES = [
  {
    id: 'wine',
    name: 'Wine Red',
    hex: '#8b2332',
    border: 'border-rose-500/70',
    ring: 'ring-rose-400',
    text: 'text-rose-100',
    lightText: 'text-rose-200/90',
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    hex: '#4927a4',
    border: 'border-purple-500/70',
    ring: 'ring-purple-400',
    text: 'text-purple-100',
    lightText: 'text-purple-200/90',
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    hex: '#8e4917',
    border: 'border-amber-500/70',
    ring: 'ring-amber-400',
    text: 'text-amber-100',
    lightText: 'text-amber-200/90',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    hex: '#0f5132',
    border: 'border-emerald-500/70',
    ring: 'ring-emerald-400',
    text: 'text-emerald-100',
    lightText: 'text-emerald-200/90',
  },
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    hex: '#0c4a6e',
    border: 'border-sky-500/70',
    ring: 'ring-sky-400',
    text: 'text-sky-100',
    lightText: 'text-sky-200/90',
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    hex: '#312e81',
    border: 'border-indigo-500/70',
    ring: 'ring-indigo-400',
    text: 'text-indigo-100',
    lightText: 'text-indigo-200/90',
  },
];

function getThemeForBooking(id: string, index = 0) {
  if (!id) return BOOKING_THEMES[index % BOOKING_THEMES.length];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % BOOKING_THEMES.length;
  return BOOKING_THEMES[idx];
}

function parseDateStr(str?: string): Date | null {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPrettyDate(str?: string): string {
  if (!str) return '—';
  const d = parseDateStr(str);
  if (!d) return str;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function calculateDiffNights(startStr?: string, endStr?: string): number {
  if (!startStr || !endStr) return 0;
  const d1 = parseDateStr(startStr);
  const d2 = parseDateStr(endStr);
  if (!d1 || !d2) return 0;
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export const BookingCalendarModal: React.FC<BookingCalendarModalProps> = ({
  isOpen,
  onClose,
  checkIn,
  checkOut,
  guestName,
  unit,
  onUnitChange,
  currentBookingId,
  allBookings = [],
  onApply,
  defaultYear = 2026,
  defaultMonth = 0,
  anchorRect,
  rateMode = 'nightly',
}) => {
  // Calendar View month & year
  const [currentYear, setCurrentYear] = useState<number>(defaultYear);
  const [currentMonth, setCurrentMonth] = useState<number>(defaultMonth);

  // Selected dates (Check-in = 2:00 PM, Check-out = 11:00 AM)
  const [selectedIn, setSelectedIn] = useState<string>(checkIn || '');
  const [selectedOut, setSelectedOut] = useState<string>(checkOut || '');

  // Hover state for interactive range preview
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Floating popover coordinates
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number }>({
    top: 60,
    left: 20,
    width: 550,
  });

  // Calculate anchored popover position
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const targetW = Math.min(560, Math.max(340, screenW - 24));

      if (anchorRect) {
        let top = anchorRect.bottom + 6;
        const estimatedH = 520;
        // If bottom overflows viewport, place above or clamp
        if (top + estimatedH > screenH) {
          if (anchorRect.top - estimatedH > 10) {
            top = anchorRect.top - estimatedH - 6;
          } else {
            top = Math.max(10, screenH - estimatedH - 10);
          }
        }
        let left = anchorRect.left;
        if (left + targetW > screenW - 14) {
          left = Math.max(10, screenW - targetW - 14);
        }
        setPopoverPos({ top: Math.round(top), left: Math.round(left), width: targetW });
      } else {
        const top = Math.max(16, Math.min(65, Math.round(screenH * 0.08)));
        const left = Math.max(10, Math.round((screenW - targetW) / 2));
        setPopoverPos({ top, left, width: targetW });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRect]);

  // Select full month helper
  const handleSelectFullMonth = (targetYear = currentYear, targetMonth = currentMonth) => {
    const startD = new Date(targetYear, targetMonth, 1);
    const endD = new Date(targetYear, targetMonth + 1, 1);
    setSelectedIn(formatDateStr(startD));
    setSelectedOut(formatDateStr(endD));
  };

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialYear = defaultYear || new Date().getFullYear();
      const initialMonth = defaultMonth !== undefined ? defaultMonth : new Date().getMonth();
      const d = parseDateStr(checkIn) || new Date(initialYear, initialMonth, 1);
      const targetY = d.getFullYear();
      const targetM = d.getMonth();
      setCurrentYear(targetY);
      setCurrentMonth(targetM);
      setHoverDate(null);

      // If monthly mode and dates are not already set (or single day), automatically reflect full month!
      if (rateMode === 'monthly' && (!checkIn || !checkOut || checkIn === checkOut)) {
        const startD = new Date(targetY, targetM, 1);
        const endD = new Date(targetY, targetM + 1, 1);
        setSelectedIn(formatDateStr(startD));
        setSelectedOut(formatDateStr(endD));
      } else {
        setSelectedIn(checkIn || '');
        setSelectedOut(checkOut || '');
      }
    }
  }, [isOpen, checkIn, checkOut, defaultYear, defaultMonth, rateMode]);

  // Handle Escape key to close without saving
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Month navigation
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Days in month calculation
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const currentUnit = unit || 'Unit 1';

  // Filter and process all existing bookings for the selected unit
  const unitBookings = useMemo(() => {
    return allBookings
      .filter((b) => {
        const bUnit = b.unit || b.channel || 'Unit 1';
        return (
          bUnit === currentUnit &&
          b.status !== 'Cancelled' &&
          b.id !== currentBookingId &&
          Boolean(b.date)
        );
      })
      .map((b, idx) => {
        let checkout = b.checkOutDate;
        if (!checkout) {
          const startD = parseDateStr(b.date);
          if (startD) {
            const n =
              typeof b.nights === 'number'
                ? b.nights
                : parseInt(String(b.nights || 1), 10) || 1;
            const endD = new Date(startD);
            endD.setDate(endD.getDate() + n);
            checkout = formatDateStr(endD);
          } else {
            checkout = b.date;
          }
        }
        return {
          ...b,
          computedCheckOut: checkout,
          theme: getThemeForBooking(b.id || `booking-${idx}`, idx),
        };
      });
  }, [allBookings, currentUnit, currentBookingId]);

  // Map each date to AM occupant (11am checkout) and PM occupant (2pm checkin)
  const calendarDaysData = useMemo(() => {
    const map = new Map<
      string,
      {
        amBooking: (typeof unitBookings)[0] | null;
        pmBooking: (typeof unitBookings)[0] | null;
        isAmCheckout: boolean;
        isPmCheckin: boolean;
        isTurnover: boolean;
        isSameGuestFullStay: boolean;
        hasConflict: boolean;
      }
    >();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;

      // Find AM occupant (stayed last night, leaves 11am today or staying through)
      const amBookings = unitBookings.filter((b) => {
        return b.date < dateStr && b.computedCheckOut >= dateStr;
      });

      // Find PM occupant (arrives 2pm today, or already staying through tonight)
      const pmBookings = unitBookings.filter((b) => {
        return b.date <= dateStr && b.computedCheckOut > dateStr;
      });

      const amBooking = amBookings[0] || null;
      const pmBooking = pmBookings[0] || null;

      const isAmCheckout = amBooking ? amBooking.computedCheckOut === dateStr : false;
      const isPmCheckin = pmBooking ? pmBooking.date === dateStr : false;

      // Turnover occurs when one guest checks out at 11am and another checks in at 2pm on the same date!
      const isTurnover = Boolean(
        amBooking && pmBooking && amBooking.id !== pmBooking.id
      );

      // Same guest staying full day (both AM and PM)
      const isSameGuestFullStay = Boolean(
        amBooking && pmBooking && amBooking.id === pmBooking.id
      );

      // Conflict occurs ONLY if more than one booking tries to occupy the SAME half
      const hasConflict = amBookings.length > 1 || pmBookings.length > 1;

      map.set(dateStr, {
        amBooking,
        pmBooking,
        isAmCheckout,
        isPmCheckin,
        isTurnover,
        isSameGuestFullStay,
        hasConflict,
      });
    }

    return map;
  }, [currentYear, currentMonth, daysInMonth, unitBookings]);

  // Active selection range (with hover preview)
  const activeStart = selectedIn;
  const activeEnd = selectedOut || (selectedIn && hoverDate && hoverDate > selectedIn ? hoverDate : '');

  // Computed nights
  const computedNights = useMemo(() => {
    if (!activeStart || !activeEnd) return 0;
    return calculateDiffNights(activeStart, activeEnd);
  }, [activeStart, activeEnd]);

  // Check if active selection conflicts with existing bookings (double-booking overnight stay)
  const selectionConflicts = useMemo(() => {
    if (!activeStart || !activeEnd) return [];
    const conflicts: { guest: string; date: string; reason: string }[] = [];

    const dStart = parseDateStr(activeStart);
    const dEnd = parseDateStr(activeEnd);
    if (!dStart || !dEnd) return conflicts;

    const curr = new Date(dStart);
    while (curr.getTime() < dEnd.getTime()) {
      const dateKey = formatDateStr(curr);
      const dayData = calendarDaysData.get(dateKey);
      if (dayData && dayData.pmBooking) {
        conflicts.push({
          guest: dayData.pmBooking.guestName || 'Existing Guest',
          date: dateKey,
          reason: `Already booked for the night of ${formatPrettyDate(dateKey)}`,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return conflicts;
  }, [activeStart, activeEnd, calendarDaysData]);

  // Interactive date clicking:
  // IMPORTANT: Does NOT auto-close after choosing dates!
  // User can review, pick presets, or click Apply to save.
  const handleDateClick = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // If in monthly mode and starting fresh, automatically select 1 full month starting on clicked date
    if (rateMode === 'monthly' && (!selectedIn || (selectedIn && selectedOut))) {
      const dIn = parseDateStr(dateStr)!;
      const dOut = new Date(dIn);
      dOut.setMonth(dOut.getMonth() + 1);
      setSelectedIn(dateStr);
      setSelectedOut(formatDateStr(dOut));
      return;
    }

    // If no check-in, or if we already have both check-in & check-out, start fresh with check-in
    if (!selectedIn || (selectedIn && selectedOut)) {
      setSelectedIn(dateStr);
      setSelectedOut('');
      return;
    }

    // Currently have check-in, user is picking check-out
    const dIn = parseDateStr(selectedIn)!;
    const dClicked = parseDateStr(dateStr)!;

    if (dClicked.getTime() > dIn.getTime()) {
      // Picked valid checkout date -> update selection (DO NOT AUTO-CLOSE)
      setSelectedOut(dateStr);
    } else if (dClicked.getTime() < dIn.getTime()) {
      // Picked earlier date -> make it new check-in
      setSelectedIn(dateStr);
      setSelectedOut('');
    } else {
      // Clicked exact same date -> make it 1 night stay (checkout next day at 11am)
      const nextDay = new Date(dClicked);
      nextDay.setDate(nextDay.getDate() + 1);
      setSelectedOut(formatDateStr(nextDay));
    }
  };

  const handleApplyPreset = (nights: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (nights === -1) {
      // Full Month preset: 1st of month to 1st of next month
      handleSelectFullMonth();
      return;
    }

    let startD = parseDateStr(selectedIn);
    if (!startD) {
      startD = new Date(currentYear, currentMonth, 1);
    }
    const endD = new Date(startD);
    endD.setDate(endD.getDate() + nights);

    setSelectedIn(formatDateStr(startD));
    setSelectedOut(formatDateStr(endD));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIn('');
    setSelectedOut('');
    setHoverDate(null);
  };

  // Explicit confirmation via Apply button
  const handleConfirmAndClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedIn) return;
    let finalOut = selectedOut;
    if (!finalOut) {
      const d = parseDateStr(selectedIn)!;
      d.setDate(d.getDate() + 1);
      finalOut = formatDateStr(d);
    }
    const nights = calculateDiffNights(selectedIn, finalOut);
    onApply(selectedIn, finalOut, nights);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 1. Subtle, non-blackout backdrop to dismiss on outside click */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* 2. Floating Popover Container */}
      <div
        style={{
          position: 'fixed',
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
          width: `${popoverPos.width}px`,
          maxHeight: 'calc(100vh - 20px)',
        }}
        className="z-50 bg-neutral-900 border border-neutral-700/90 rounded-xl shadow-2xl text-neutral-100 flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
              rateMode === 'monthly'
                ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-400'
                : 'bg-sky-950/80 border-sky-800/80 text-sky-400'
            }`}>
              <CalendarIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-neutral-100 truncate">
                  Availability & Turnover Calendar
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800/80 text-sky-300 font-mono font-medium shrink-0">
                  2pm In • 11am Out
                </span>
                {rateMode === 'monthly' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-700/80 text-emerald-300 font-mono font-semibold shrink-0">
                    Monthly Mode
                  </span>
                )}
              </div>
              {guestName && (
                <div className="text-[10px] text-sky-300 truncate flex items-center gap-1">
                  <User className="w-2.5 h-2.5 shrink-0" />
                  <span>{guestName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Unit Switcher Tabs */}
            <div className="inline-flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5">
              {UNITS.map((u) => {
                const isSelected = u === currentUnit;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnitChange && onUnitChange(u);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white font-semibold shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/70'
                    }`}
                  >
                    {u}
                  </button>
                );
              })}
            </div>

            {/* Close (X) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              title="Close Calendar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Range Strip & Visual Legend */}
        <div className="px-3 py-1.5 bg-neutral-950/40 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-200 flex-wrap">
            <div className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5">
              <span className="text-[9px] text-neutral-500 font-bold block uppercase leading-tight">
                Check-in (2pm)
              </span>
              <span className="font-mono text-[11px] font-semibold text-neutral-100">
                {activeStart ? formatPrettyDate(activeStart) : 'Select date'}
              </span>
            </div>

            <ArrowRight className="w-3 h-3 text-neutral-600 shrink-0" />

            <div className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5">
              <span className="text-[9px] text-neutral-500 font-bold block uppercase leading-tight">
                Check-out (11am)
              </span>
              <span className="font-mono text-[11px] font-semibold text-neutral-100">
                {activeEnd ? formatPrettyDate(activeEnd) : 'Select date'}
              </span>
            </div>

            {computedNights > 0 && (
              <div className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0 border ${
                computedNights >= 28 || rateMode === 'monthly'
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                  : 'bg-sky-950 border-sky-800 text-sky-300'
              }`}>
                {computedNights} {computedNights === 1 ? 'Nt' : 'Nts'}
                {computedNights >= 28 ? ' • Full Month' : ''}
              </div>
            )}

            {/* Quick Full Month Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFullMonth();
              }}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/90 text-emerald-300 flex items-center gap-1 transition-all shadow-xs"
              title={`Select full month of ${MONTH_NAMES[currentMonth]} (${daysInMonth} nights)`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Full {MONTH_NAMES[currentMonth].slice(0, 3)} ({daysInMonth} nts)</span>
            </button>
          </div>

          {/* Visual Legend for Halved Date Boxes */}
          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
            <div className="flex items-center gap-1" title="Check-in day: 2pm check-in (afternoon half shaded)">
              <span className="inline-block w-3 h-3 rounded-sm border border-neutral-700 overflow-hidden relative bg-neutral-900">
                <span
                  className="absolute inset-0 bg-sky-500"
                  style={{ clipPath: 'polygon(100% 0%, 100% 100%, 0% 100%)' }}
                />
              </span>
              <span className="text-neutral-300">2pm In</span>
            </div>

            <div className="flex items-center gap-1" title="Stay: full overnight stay (full day shaded)">
              <span className="inline-block w-3 h-3 rounded-sm bg-sky-500 border border-sky-400" />
              <span className="text-neutral-300">Stay</span>
            </div>

            <div className="flex items-center gap-1" title="Check-out day: 11am check-out (morning half shaded)">
              <span className="inline-block w-3 h-3 rounded-sm border border-neutral-700 overflow-hidden relative bg-neutral-900">
                <span
                  className="absolute inset-0 bg-sky-500"
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)' }}
                />
              </span>
              <span className="text-neutral-300">11am Out</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="px-1 py-0.2 rounded bg-amber-400 text-neutral-950 font-black text-[7px] uppercase tracking-wider">
                TURNOVER
              </span>
            </div>
          </div>
        </div>

        {/* Conflict Alert Banner if any double booking detected */}
        {selectionConflicts.length > 0 && (
          <div className="px-3 py-1 bg-rose-950/70 border-b border-rose-800/80 flex items-center gap-1.5 text-[11px] text-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              <strong>Conflict:</strong> Double-booking with {selectionConflicts[0].guest} on{' '}
              {selectionConflicts[0].date}.
            </span>
          </div>
        )}

        {/* Month Navigator */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/50 border-b border-neutral-800/60">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-300 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs tracking-wide text-neutral-100">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleToday}
              className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-300 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 7-Column Calendar Grid */}
        <div className="p-2.5 overflow-y-auto max-h-[340px]">
          {/* Weekday Labels (SUN, MON, TUE, WED, THU, FRI, SAT) */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-neutral-400 uppercase tracking-wider py-0.5 mb-1">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div
                key={`empty-start-${idx}`}
                className="h-[52px] rounded-lg border border-neutral-900 bg-neutral-950/40 opacity-20 pointer-events-none"
              />
            ))}

            {/* Calendar Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;

              const dayData = calendarDaysData.get(dateStr);
              const {
                amBooking,
                pmBooking,
                isTurnover,
                isSameGuestFullStay,
                hasConflict,
              } = dayData || {
                amBooking: null,
                pmBooking: null,
                isTurnover: false,
                isSameGuestFullStay: false,
                hasConflict: false,
              };

              // Active Selection Breakdown:
              // 1. isSelectedStart: Check-in date (starts at 2:00 PM -> PM half is selected)
              // 2. isSelectedEnd: Check-out date (ends at 11:00 AM -> AM half is selected)
              // 3. isInSelectedRange: Overnight stay (both AM and PM are selected)
              const isSelectedStart = dateStr === activeStart;
              const isSelectedEnd = dateStr === activeEnd;
              const isInSelectedRange =
                Boolean(activeStart && activeEnd && dateStr > activeStart && dateStr < activeEnd);

              const isPartOfSelection = isSelectedStart || isSelectedEnd || isInSelectedRange;

              // Selection Theme Color (vibrant sky blue)
              const SELECTION_COLOR = '#0284c7'; // Sky-600

              // Determine whether AM half is occupied / selected
              const isAmSelected = Boolean((isInSelectedRange || isSelectedEnd) && activeStart);
              const amOccupied = isAmSelected || Boolean(amBooking);
              const amColor = isAmSelected
                ? SELECTION_COLOR
                : amBooking
                ? amBooking.theme.hex
                : '#171717';
              const amGuestText = isAmSelected
                ? isSelectedEnd
                  ? 'Check-Out'
                  : 'Stay'
                : amBooking?.guestName || 'Guest';

              // Determine whether PM half is occupied / selected
              const isPmSelected = Boolean((isInSelectedRange || isSelectedStart) && activeStart);
              const pmOccupied = isPmSelected || Boolean(pmBooking);
              const pmColor = isPmSelected
                ? SELECTION_COLOR
                : pmBooking
                ? pmBooking.theme.hex
                : '#171717';
              const pmGuestText = isPmSelected
                ? isSelectedStart
                  ? 'Check-In'
                  : 'Stay'
                : pmBooking?.guestName || 'Guest';

              // Check if day is a solid full stay (same active selection or same booking both AM & PM)
              const isSolidActiveSelectionStay = isInSelectedRange;
              const isSolidBookingStay =
                isSameGuestFullStay && !hasConflict && !isAmSelected && !isPmSelected;
              const isFullStay = isSolidActiveSelectionStay || isSolidBookingStay;

              // Split / Halved day condition
              const isHalvedDay =
                !isFullStay && (amOccupied || pmOccupied || isSelectedStart || isSelectedEnd);

              // Effective turnover occurs if both AM and PM are occupied by different guests or checkout/checkin
              const hasTurnoverBadge =
                isTurnover ||
                (isSelectedStart && Boolean(amBooking)) ||
                (isSelectedEnd && Boolean(pmBooking));

              return (
                <div
                  key={dateStr}
                  onClick={(e) => handleDateClick(dateStr, e)}
                  onMouseEnter={() => {
                    if (selectedIn && !selectedOut) {
                      setHoverDate(dateStr);
                    }
                  }}
                  className={`relative w-full h-[52px] rounded-lg overflow-hidden cursor-pointer transition-all duration-100 group border ${
                    hasConflict
                      ? 'border-rose-500 ring-2 ring-rose-500'
                      : isPartOfSelection
                      ? 'border-sky-400 ring-2 ring-sky-400 shadow-md shadow-sky-950/60 z-10'
                      : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                  title={`${dateStr} • Click to select (Check-in 2pm / Check-out 11am)`}
                >
                  {/* CASE 1: FULL OVERNIGHT STAY (Solid box filled completely) */}
                  {isFullStay ? (
                    <div
                      className="w-full h-full p-1 flex flex-col justify-between text-white shadow-inner"
                      style={{
                        backgroundColor: isSolidActiveSelectionStay
                          ? SELECTION_COLOR
                          : amBooking?.theme.hex || '#0284c7',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold leading-none text-white drop-shadow">
                          {dayNum}
                        </span>
                        {isSolidActiveSelectionStay && (
                          <span className="text-[8px] font-bold px-1 py-0.2 bg-white/20 rounded text-white leading-none">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-center justify-center -mt-1 text-center px-0.5">
                        <span className="text-[10px] font-bold text-white truncate max-w-full leading-tight drop-shadow">
                          {isSolidActiveSelectionStay
                            ? guestName || 'Active Selection'
                            : amBooking?.guestName || 'Guest'}
                        </span>
                        <span className="text-[8px] font-mono text-white/90 leading-none">
                          Stay
                        </span>
                      </div>
                      <div className="text-[7px] text-white/80 font-mono text-right leading-none">
                        Overnight
                      </div>
                    </div>
                  ) : isHalvedDay ? (
                    /* CASE 2: HALVED DATE BOX (Check-in 2pm, Check-out 11am, or Turnover) */
                    <div className="relative w-full h-full overflow-hidden bg-neutral-900">
                      {/* AM Half (Top-Left Triangle: Check-out / Morning 11am) */}
                      <div
                        className="absolute inset-0 transition-colors"
                        style={{
                          clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)',
                          backgroundColor: amColor,
                        }}
                      />

                      {/* PM Half (Bottom-Right Triangle: Check-in / Afternoon 2pm) */}
                      <div
                        className="absolute inset-0 transition-colors"
                        style={{
                          clipPath: 'polygon(100% 0%, 100% 100%, 0% 100%)',
                          backgroundColor: pmColor,
                        }}
                      />

                      {/* Diagonal Divider Line (Bottom-Left to Top-Right) */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                      >
                        <line
                          x1="0"
                          y1="100"
                          x2="100"
                          y2="0"
                          stroke={
                            amOccupied && pmOccupied
                              ? 'rgba(255, 255, 255, 0.7)'
                              : 'rgba(255, 255, 255, 0.35)'
                          }
                          strokeWidth="1.5"
                        />
                      </svg>

                      {/* TURNOVER Badge in Center / Top-Right if applicable */}
                      {hasTurnoverBadge && (
                        <div className="absolute top-0.5 right-0.5 z-20 pointer-events-none">
                          <span className="inline-flex items-center px-1 py-0.2 rounded bg-amber-400 text-neutral-950 font-black text-[7px] tracking-wider uppercase shadow">
                            TURNOVER
                          </span>
                        </div>
                      )}

                      {/* AM (Top-Left Half) Information */}
                      <div className="absolute top-0.5 left-1 z-20 flex flex-col items-start pointer-events-none max-w-[65%]">
                        <span
                          className={`text-xs font-bold leading-none ${
                            amOccupied ? 'text-white drop-shadow' : 'text-neutral-400'
                          }`}
                        >
                          {dayNum}
                        </span>
                        {isAmSelected && isSelectedEnd ? (
                          <div className="mt-0.5">
                            <span className="text-[8px] font-black text-white bg-sky-950/80 px-1 py-0.2 rounded border border-sky-400/60 leading-none inline-block drop-shadow">
                              OUT 11AM
                            </span>
                            <span className="text-[7px] text-white/90 truncate block max-w-[55px] font-semibold leading-none mt-0.5">
                              {guestName || 'Check-Out'}
                            </span>
                          </div>
                        ) : amOccupied ? (
                          <div className="mt-0.5">
                            <span className="text-[8px] font-bold text-white leading-none block drop-shadow">
                              11am Out
                            </span>
                            <span className="text-[8px] text-white/90 truncate block max-w-[50px] font-medium leading-none">
                              {amGuestText}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[7px] text-neutral-500 font-medium block mt-0.5">
                            AM Vacant
                          </span>
                        )}
                      </div>

                      {/* PM (Bottom-Right Half) Information */}
                      <div className="absolute bottom-0.5 right-1 z-20 flex flex-col items-end text-right pointer-events-none max-w-[65%]">
                        {isPmSelected && isSelectedStart ? (
                          <div>
                            <span className="text-[8px] font-black text-white bg-sky-950/80 px-1 py-0.2 rounded border border-sky-400/60 leading-none inline-block drop-shadow">
                              IN 2PM
                            </span>
                            <span className="text-[7px] text-white/90 truncate block max-w-[55px] font-semibold leading-none mt-0.5">
                              {guestName || 'Check-In'}
                            </span>
                          </div>
                        ) : pmOccupied ? (
                          <div>
                            <span className="text-[8px] font-bold text-white leading-none block drop-shadow">
                              2pm In
                            </span>
                            <span className="text-[8px] text-white/90 truncate block max-w-[50px] font-medium leading-none">
                              {pmGuestText}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[7px] text-neutral-500 font-medium block">
                            PM Vacant
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* CASE 3: FULLY VACANT DAY (Both AM and PM Available) */
                    <div className="w-full h-full p-1 bg-neutral-900/60 flex flex-col justify-between hover:bg-neutral-800 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-neutral-300 leading-none">
                          {dayNum}
                        </span>
                        <span className="text-[8px] text-neutral-500 font-medium block mt-0.5">
                          Vacant
                        </span>
                      </div>
                      <div className="text-[7px] text-neutral-600 font-mono text-right">
                        2pm/11am
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Presets & Action Footer */}
        <div className="px-3 py-2 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Presets */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider mr-0.5">
              Nts:
            </span>
            {PRESETS.map((p) => {
              const isMatch =
                p.nights === -1
                  ? computedNights >= 28 && computedNights <= 31 && selectedIn && selectedOut
                  : computedNights === p.nights && selectedIn && selectedOut;

              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={(e) => handleApplyPreset(p.nights, e)}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    isMatch
                      ? p.nights === -1 || rateMode === 'monthly'
                        ? 'bg-emerald-900/80 border-emerald-600 text-emerald-200 font-bold'
                        : 'bg-sky-900/80 border-sky-600 text-sky-200 font-bold'
                      : p.nights === -1
                      ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-400 hover:text-emerald-200 hover:border-emerald-700'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-200 rounded hover:bg-neutral-900 transition-colors"
              title="Reset selected dates"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-2.5 py-1 text-[11px] text-neutral-400 hover:text-neutral-200 rounded hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>

            {/* The user explicitly wants to click Apply! */}
            <button
              type="button"
              id="calendar-apply-dates-btn"
              onClick={handleConfirmAndClose}
              disabled={!selectedIn}
              className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded-lg transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] ${
                rateMode === 'monthly' || computedNights >= 28
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-950/60'
                  : 'bg-sky-500 hover:bg-sky-400 text-neutral-950 shadow-sky-950/60'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                Apply {computedNights > 0 ? `(${computedNights} Nts${computedNights >= 28 ? ' - Full Month' : ''})` : 'Dates'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
