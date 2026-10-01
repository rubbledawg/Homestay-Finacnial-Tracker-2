import { migrateLedger } from './accounting';
import { cloudStore as localStorage } from '../lib/cloudStore';
import { MonthData, Partner, BusinessTracker } from '../types';
import { createEmptyMonths, calculateAllMonths } from './calculations';


export const STORAGE_KEY_BUSINESSES = 'airbnb_businesses_list_v2';
export const STORAGE_KEY_DELETED_BIZ = 'airbnb_deleted_business_ids_v2';
export const STORAGE_KEY_ACTIVE_BIZ = 'airbnb_active_business_id_v2';
export const STORAGE_KEY_DATA = 'airbnb_tracker_data_v2';
export const STORAGE_KEY_PARTNERS = 'airbnb_tracker_partners_v2';
export const STORAGE_KEY_YEAR = 'airbnb_tracker_year_v2';

export const DATA_KEY_PREFIXES = [
  'airbnb_tracker_data_v2',
  'airbnb_financial_tracker_data',
  'airbnb_tracker_data',
];

export const PARTNER_KEY_PREFIXES = [
  'airbnb_tracker_partners_v2',
  'airbnb_financial_partners',
  'airbnb_tracker_partners',
];

export const DEFAULT_PARTNERS: Partner[] = [
  { id: 'p-1', name: 'Partner A', sharePercentage: 50.0 },
  { id: 'p-2', name: 'Partner B', sharePercentage: 50.0 },
];

export const DEFAULT_BUSINESSES: BusinessTracker[] = [
  {
    id: 'biz-default',
    name: 'Property 1 (Main Rental)',
    category: 'Airbnb / Vacation Rental',
    currency: 'PHP',
    description: 'Income, Maintenance & Automated Monthly Net Profit Carryover',
    createdAt: 1710000000000,
  },
  {
    id: 'biz-secondary',
    name: 'Property 2 (Secondary Unit)',
    category: 'Airbnb / Vacation Rental',
    currency: 'PHP',
    description: 'Vacation Rental Property & Financial Management',
    createdAt: 1710000001000,
  },
];

/**
 * Helper to identify if a business ID or name refers to WAJ FINANCES
 */
export function isWajBusiness(bizId?: string): boolean {
  if (!bizId) return false;
  if (
    bizId === 'biz-default' ||
    bizId === 'biz-waj' ||
    bizId === 'biz-waj-finances' ||
    bizId.toLowerCase().includes('waj')
  ) {
    return true;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BUSINESSES);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const found = list.find((b: any) => b.id === bizId);
        if (found && typeof found.name === 'string' && found.name.toUpperCase().includes('WAJ')) {
          return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

/**
 * Calculates a data richness score to find which store has real user entries vs empty stubs
 */
export function calculateDataScore(months: MonthData[]): number {
  if (!Array.isArray(months)) return 0;
  return months.reduce((score, m) => {
    const bookingsCount = Array.isArray(m.bookings) ? m.bookings.length : 0;
    const ledgerCount = Array.isArray(m.ledger) ? m.ledger.length : 0;
    return score + bookingsCount * 20 + ledgerCount;
  }, 0);
}

/**
 * Safely parses and normalizes month data structure without injecting any random or mock expenses.
 * Preserves all supplied records and adds accounting classifications without changing amounts.
 */
export function normalizeMonthData(rawMonths: any[], bizId?: string): MonthData[] {
  if (!Array.isArray(rawMonths)) return [];
  return rawMonths.filter(m => m && typeof m === 'object').map((m: any) => {
    const ledger = Array.isArray(m.ledger) ? m.ledger.filter(Boolean) : [];

    const cleanMonth: MonthData = {
      ...m,
      id: m.id,
      name: m.name,
      shortName: m.shortName,
      year: m.year,
      bookings: Array.isArray(m.bookings) ? m.bookings : [],
      ledger: migrateLedger(ledger, bizId ? recoverPartnersData(bizId) : []),
    };

    if (
      m.initialBalanceOverride !== undefined &&
      m.initialBalanceOverride !== null &&
      m.initialBalanceOverride !== ''
    ) {
      cleanMonth.initialBalanceOverride = Number(m.initialBalanceOverride);
    }

    return cleanMonth;
  });
}

/**
 * Recovers months data for a specific business without cross-contaminating from other businesses.
 * Does not inject or remove historical statement rows.
 */
export function recoverMonthsData(bizId: string, yr: number): MonthData[] {
  const raw = localStorage.getItem(`${STORAGE_KEY_DATA}_${bizId}_${yr}`);
  if (raw) return normalizeMonthData(JSON.parse(raw), bizId);
  return createEmptyMonths(yr);
}

export function recoverPartnersData(bizId: string): Partner[] {
  try {
    const specificKey = `${STORAGE_KEY_PARTNERS}_${bizId}`;
    const primaryRaw = localStorage.getItem(specificKey);
    if (primaryRaw) {
      try {
        const parsed = JSON.parse(primaryRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }

    if (bizId === 'biz-default') {
      for (const prefix of PARTNER_KEY_PREFIXES) {
        const raw = localStorage.getItem(prefix);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }
  } catch (e) {
    console.error('Error recovering partners data', e);
  }

  return DEFAULT_PARTNERS;
}

/**
 * Recovers business list respecting user deletions
 */
export function recoverBusinesses(): BusinessTracker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BUSINESSES);
    const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let list = parsed.map((b: any) => {
          if (b.id === 'biz-luxinhaus' && (b.name === 'Luxinhaus' || b.name?.toLowerCase().includes('luxin'))) {
            return {
              ...b,
              name: 'Luxinhaus Siargao',
              description: 'Luxinhaus Siargao Vacation Rental Property & Financial Management',
            };
          }
          return b;
        });

        // Filter out any business explicitly deleted by the user
        list = list.filter((b: any) => b && !deletedIds.includes(b.id));

        if (list.length > 0) {
          return list;
        }
      }
    }
  } catch (e) {
    console.error('Error recovering businesses', e);
  }

  // Fallback for new sessions, filtering out any deleted businesses
  try {
    const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    const defaults = DEFAULT_BUSINESSES.filter((b) => !deletedIds.includes(b.id));
    if (defaults.length > 0) {
      return defaults;
    }
  } catch (e) {
    // ignore
  }

  return [DEFAULT_BUSINESSES[0]];
}

export interface FullFinancialBackup {
  version: number;
  exportedAt: string;
  source: string;
  businesses: BusinessTracker[];
  data: {
    [businessId: string]: {
      partners: Partner[];
      years: {
        [year: number]: MonthData[];
      };
    };
  };
}

/**
 * Creates an exhaustive backup snapshot of all businesses, partners, and financial years
 */
export function exportFullFinancialBackup(): FullFinancialBackup {
  const businesses = recoverBusinesses();
  const data: FullFinancialBackup['data'] = {};
  const years = new Set<number>([new Date().getFullYear()]);
  const selectedYear = Number(localStorage.getItem(STORAGE_KEY_YEAR));
  if (Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100) years.add(selectedYear);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || '';
    if (DATA_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
      const match = key.match(/_(\d{4})$/);
      if (match) years.add(Number(match[1]));
    }
  }
  const yearsToExport = [...years].sort((a, b) => a - b);

  for (const biz of businesses) {
    const partners = recoverPartnersData(biz.id);
    const yearsData: Record<number, MonthData[]> = {};
    for (const yr of yearsToExport) {
      yearsData[yr] = recoverMonthsData(biz.id, yr);
    }
    data[biz.id] = {
      partners,
      years: yearsData,
    };
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    source: 'Airbnb Financial Management System',
    businesses,
    data,
  };
}

/**
 * Triggers browser download of complete JSON financial database
 */
async function embedReceipts(value: any): Promise<any> {
  if (typeof value === 'string' && /^\/api\/files\/[a-f0-9]{64}$/.test(value)) {
    const response = await fetch(value);
    if (!response.ok) throw new Error('Receipt download failed');
    const blob = await response.blob();
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  }
  if (Array.isArray(value)) return Promise.all(value.map(embedReceipts));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k, await embedReceipts(v)])));
  return value;
}
export async function downloadBackupFile(): Promise<void> {
  const backup = await embedReceipts(exportFullFinancialBackup());
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financial_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Restores all businesses, partners, and years from a JSON backup file
 */
export function importFullFinancialBackup(jsonString: string): {
  success: boolean;
  message: string;
  businesses?: BusinessTracker[];
} {
  try {
    const parsed = JSON.parse(jsonString) as FullFinancialBackup;
    if (!parsed || !Array.isArray(parsed.businesses) || parsed.businesses.length === 0 || !parsed.data) {
      return { success: false, message: 'Invalid backup file structure.' };
    }

    // Validate the entire file before touching existing records.
    const ids = new Set<string>();
    for (const biz of parsed.businesses) {
      if (!biz || typeof biz.id !== 'string' || !biz.id || ids.has(biz.id) || typeof biz.name !== 'string') {
        return { success: false, message: 'Invalid or duplicate property in backup.' };
      }
      ids.add(biz.id);
      const payload = parsed.data[biz.id];
      if (!payload || !Array.isArray(payload.partners) || !payload.years ||
        payload.partners.some(p => !p || typeof p.name !== 'string' || !Number.isFinite(p.sharePercentage))) {
        return { success: false, message: 'Invalid property records in backup.' };
      }
      for (const [year, months] of Object.entries(payload.years)) {
        if (!/^\d{4}$/.test(year) || !Array.isArray(months) || months.length !== 12 ||
          new Set(months.map(m => m?.id)).size !== 12 ||
          months.some(m => !m || !['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].includes(m.id) ||
            !Array.isArray(m.ledger) || !Array.isArray(m.bookings) ||
            [...m.ledger, ...m.bookings].some(row => !row || typeof row.id !== 'string'))) {
          return { success: false, message: 'Invalid year or month records in backup.' };
        }
      }
    }

    // Save businesses list
    localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(parsed.businesses));
    const deletedIds = JSON.parse(localStorage.getItem(STORAGE_KEY_DELETED_BIZ) || '[]');
    localStorage.setItem(STORAGE_KEY_DELETED_BIZ, JSON.stringify(deletedIds.filter((id: string) => !ids.has(id))));

    // Save each business's partners and yearly data
    for (const biz of parsed.businesses) {
      const bizPayload = parsed.data[biz.id];
      if (bizPayload) {
        if (Array.isArray(bizPayload.partners)) {
          localStorage.setItem(
            `${STORAGE_KEY_PARTNERS}_${biz.id}`,
            JSON.stringify(bizPayload.partners)
          );
        }
        if (bizPayload.years) {
          for (const yrStr of Object.keys(bizPayload.years)) {
            const yr = parseInt(yrStr, 10);
            if (!isNaN(yr) && Array.isArray(bizPayload.years[yr])) {
              const cleaned = normalizeMonthData(bizPayload.years[yr], biz.id);
              localStorage.setItem(
                `${STORAGE_KEY_DATA}_${biz.id}_${yr}`,
                JSON.stringify(cleaned)
              );
            }
          }
        }
      }
    }

    return {
      success: true,
      message: `Successfully restored ${parsed.businesses.length} businesses and their financial records!`,
      businesses: parsed.businesses,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to import backup: ${err?.message || String(err)}`,
    };
  }
}

/** Recompute earlier saved years before the selected year; cash and partner debt cross December independently. */
export function calculateBusinessYear(bizId:string,year:number,months:MonthData[],partners:Partner[]) {
  const years=new Set<number>();
  for(let i=0;i<localStorage.length;i++) {
    const key=localStorage.key(i) || '';
    const prefix=STORAGE_KEY_DATA+'_'+bizId+'_';
    if(key.startsWith(prefix)) { const y=Number(key.slice(prefix.length));if(Number.isInteger(y)&&y<year)years.add(y); }
  }
  let cash=0,balances={};
  const carried=(list:MonthData[])=>list.map((m,i)=>i===0&&!m.openingCashIsManual&&m.initialBalanceOverride===0?{...m,initialBalanceOverride:undefined}:m);
  for(const y of [...years].sort((a,b)=>a-b)) {
    const result=calculateAllMonths(carried(recoverMonthsData(bizId,y)),cash,partners,balances);
    const last=result.dec;if(last){cash=last.endingBalance;balances=last.partnerBalances || {};}
  }
  return calculateAllMonths(years.size?carried(months):months,cash,partners,balances);
}
