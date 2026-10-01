import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  SetOptions,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { BusinessTracker, MonthData, Partner } from '../types';
import {
  recoverBusinesses,
  recoverPartnersData,
  recoverMonthsData,
  normalizeMonthData,
  STORAGE_KEY_BUSINESSES,
  STORAGE_KEY_DELETED_BIZ,
  STORAGE_KEY_PARTNERS,
  STORAGE_KEY_DATA,
} from '../utils/dataRecovery';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

interface WriteQueueEntry {
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  pendingData: {
    docRef: any;
    data: any;
    options: SetOptions;
    resolve: () => void;
    reject: (err: any) => void;
  } | null;
  backoffUntil: number;
}

const writeQueues = new Map<string, WriteQueueEntry>();

/**
 * Deeply strips all undefined fields from an object or array.
 * Firestore setDoc strictly forbids undefined values and throws:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean as T;
}

/**
 * Robust Coalesced and Debounced Write to Firestore:
 * - Debounces rapid edits (e.g. typing numbers, updating ledgers)
 * - Guarantees at most ONE in-flight write per document path
 * - Coalesces multiple rapid state updates into the single latest snapshot
 * - Defends against [resource-exhausted: Write stream exhausted maximum allowed queued writes]
 *   by enforcing rate limiting, backpressure pause, and exponential backoff.
 */
export function debouncedSetDoc(
  path: string,
  docRef: any,
  data: any,
  options: SetOptions = { merge: true },
  debounceMs: number = 1200
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let entry = writeQueues.get(path);
    if (!entry) {
      entry = {
        timer: null,
        inFlight: false,
        pendingData: null,
        backoffUntil: 0,
      };
      writeQueues.set(path, entry);
    }

    // Attach latest payload and merge resolve callbacks
    if (entry.pendingData) {
      const prevResolve = entry.pendingData.resolve;
      const prevReject = entry.pendingData.reject;
      entry.pendingData = {
        docRef,
        data,
        options,
        resolve: () => {
          prevResolve();
          resolve();
        },
        reject: (err) => { prevReject(err); reject(err); },
      };
    } else {
      entry.pendingData = {
        docRef,
        data,
        options,
        resolve,
        reject,
      };
    }

    // Reset debounce timer
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    const executeWrite = async () => {
      if (!entry) return;
      if (entry.inFlight) return; // Wait until current in-flight write completes

      const now = Date.now();
      if (now < entry.backoffUntil) {
        // In backoff period (e.g. following previous resource-exhausted); wait until cleared
        const waitTime = entry.backoffUntil - now + 200;
        entry.timer = setTimeout(executeWrite, waitTime);
        return;
      }

      if (!entry.pendingData) return;

      const current = entry.pendingData;
      entry.pendingData = null;
      entry.inFlight = true;

      try {
        const safeData = sanitizeForFirestore(current.data);
        await setDoc(current.docRef, safeData, current.options);
        current.resolve();
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isResourceExhausted =
          errMsg.includes('resource-exhausted') ||
          errMsg.includes('queued writes') ||
          err?.code === 'resource-exhausted';

        if (isResourceExhausted) {
          console.warn(`[Firestore] Write stream throttled for ${path}. Applying 6s cooldown.`);
          entry.backoffUntil = Date.now() + 6000;
        }

        handleFirestoreError(err, OperationType.WRITE, path);
        current.reject(err);
      } finally {
        entry.inFlight = false;
        // If another update was queued while in flight, schedule it with a safe gap (min 400ms)
        if (entry.pendingData) {
          const delay = Math.max(400, entry.backoffUntil - Date.now());
          entry.timer = setTimeout(executeWrite, delay);
        }
      }
    };

    entry.timer = setTimeout(executeWrite, debounceMs);
  });
}

/**
 * Cancel any pending write timers across all paths
 */
export function cancelPendingFirestoreWrites() {
  writeQueues.forEach((entry) => {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.pendingData?.reject(new Error('Cloud save cancelled; your local copy is retained.'));
    entry.pendingData = null;
  });
}

/**
 * Fetch all businesses for a user once (Promise-based)
 */
export async function fetchUserBusinesses(userId: string): Promise<BusinessTracker[]> {
  const path = `users/${userId}/businesses`;
  try {
    const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];

    const bizCollectionRef = collection(db, 'users', userId, 'businesses');
    const snapshot = await getDocs(bizCollectionRef);
    const items: BusinessTracker[] = [];
    snapshot.forEach((docSnap) => {
      if (!deletedIds.includes(docSnap.id)) {
        items.push(docSnap.data() as BusinessTracker);
      }
    });
    items.sort((a, b) => a.createdAt - b.createdAt);
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
}

/**
 * Fetch partners for a specific business once (Promise-based)
 */
export async function fetchBusinessPartners(
  userId: string,
  businessId: string
): Promise<Partner[] | null> {
  const path = `users/${userId}/businesses/${businessId}/settings/partners`;
  try {
    const docRef = doc(db, 'users', userId, 'businesses', businessId, 'settings', 'partners');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.partners) && data.partners.length > 0) {
        return data.partners as Partner[];
      }
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
}

/**
 * Fetch 12-month year data once (Promise-based)
 */
export async function fetchBusinessYearData(
  userId: string,
  businessId: string,
  year: number
): Promise<MonthData[] | null> {
  const path = `users/${userId}/businesses/${businessId}/years/${year}`;
  try {
    const docRef = doc(
      db,
      'users',
      userId,
      'businesses',
      businessId,
      'years',
      year.toString()
    );
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.monthsData) && data.monthsData.length > 0) {
        return data.monthsData as MonthData[];
      }
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
}

/**
 * Real-time listener for user's businesses
 */
export function subscribeUserBusinesses(
  userId: string,
  onUpdate: (businesses: BusinessTracker[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/businesses`;
  const bizCollectionRef = collection(db, 'users', userId, 'businesses');
  return onSnapshot(
    bizCollectionRef,
    (snapshot) => {
      // Ignore local optimistic mutations to prevent ping-pong loops
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }
      const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
      const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];

      const items: BusinessTracker[] = [];
      snapshot.forEach((docSnap) => {
        if (!deletedIds.includes(docSnap.id)) {
          items.push(docSnap.data() as BusinessTracker);
        }
      });
      items.sort((a, b) => a.createdAt - b.createdAt);
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

/**
 * Save or update a single business tracker
 */
export async function saveUserBusiness(userId: string, business: BusinessTracker) {
  const path = `users/${userId}/businesses/${business.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'businesses', business.id);
    await debouncedSetDoc(path, docRef, { ...business, ownerId: userId, updatedAt: Date.now() }, { merge: true }, 300);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Delete a business tracker and all associated cloud subdocuments
 */
export async function deleteUserBusiness(userId: string, businessId: string) {
  const path = `users/${userId}/businesses/${businessId}`;
  try {
    // 1. Delete main business document
    const docRef = doc(db, 'users', userId, 'businesses', businessId);
    await deleteDoc(docRef);

    // 2. Delete all subcollection documents (years and partners)
    const years = ['2024', '2025', '2026', '2027'];
    for (const yr of years) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'businesses', businessId, 'years', yr));
      } catch (e) {
        // Non-blocking cleanup
      }
    }
    try {
      await deleteDoc(doc(db, 'users', userId, 'businesses', businessId, 'settings', 'partners'));
    } catch (e) {
      // Non-blocking cleanup
    }

    // 3. Mark in user profile to prevent re-creation
    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          deletedBusinessIds: arrayUnion(businessId),
          lastSyncedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      // Non-blocking
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

/**
 * Subscribe to partners for a specific business
 */
export function subscribeBusinessPartners(
  userId: string,
  businessId: string,
  onUpdate: (partners: Partner[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/businesses/${businessId}/settings/partners`;
  const docRef = doc(db, 'users', userId, 'businesses', businessId, 'settings', 'partners');
  return onSnapshot(
    docRef,
    (docSnap) => {
      // Ignore local pending writes to avoid circular write loops
      if (docSnap.metadata.hasPendingWrites) {
        return;
      }
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.partners) && data.partners.length > 0) {
          onUpdate(data.partners);
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

/**
 * Save partners for a specific business with write coalescing and debouncing
 */
export async function saveBusinessPartners(
  userId: string,
  businessId: string,
  partners: Partner[],
  debounceMs: number = 1000
) {
  const path = `users/${userId}/businesses/${businessId}/settings/partners`;
  try {
    const docRef = doc(db, 'users', userId, 'businesses', businessId, 'settings', 'partners');
    await debouncedSetDoc(
      path,
      docRef,
      { partners, updatedAt: Date.now() },
      { merge: true },
      debounceMs
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Subscribe to 12-month data for a specific business and year
 */
export function subscribeBusinessYearData(
  userId: string,
  businessId: string,
  year: number,
  onUpdate: (months: MonthData[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/businesses/${businessId}/years/${year}`;
  const docRef = doc(
    db,
    'users',
    userId,
    'businesses',
    businessId,
    'years',
    year.toString()
  );
  return onSnapshot(
    docRef,
    (docSnap) => {
      // Ignore local pending writes to avoid write-stream saturation loop
      if (docSnap.metadata.hasPendingWrites) {
        return;
      }
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.monthsData) && data.monthsData.length > 0) {
          onUpdate(data.monthsData);
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

/**
 * Save 12-month data for a specific business and year with write coalescing and debouncing
 */
export async function saveBusinessYearData(
  userId: string,
  businessId: string,
  year: number,
  monthsData: MonthData[],
  debounceMs: number = 1200
) {
  const path = `users/${userId}/businesses/${businessId}/years/${year}`;
  try {
    const docRef = doc(
      db,
      'users',
      userId,
      'businesses',
      businessId,
      'years',
      year.toString()
    );
    await debouncedSetDoc(
      path,
      docRef,
      {
        year,
        monthsData,
        updatedAt: Date.now(),
      },
      { merge: true },
      debounceMs
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Immediate, non-debounced save of 12-month financial ledger to Firestore
 */
export async function saveBusinessYearDataImmediate(
  userId: string,
  businessId: string,
  year: number,
  monthsData: MonthData[]
): Promise<void> {
  const path = `users/${userId}/businesses/${businessId}/years/${year}`;
  try {
    const docRef = doc(
      db,
      'users',
      userId,
      'businesses',
      businessId,
      'years',
      year.toString()
    );
    const safeYearPayload = sanitizeForFirestore({
      year,
      monthsData,
      updatedAt: Date.now(),
    });
    await setDoc(docRef, safeYearPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Comprehensive One-Click Full Push:
 * Uploads ALL businesses, all partners, and all financial years from localStorage into Google Cloud Firestore.
 * Ensures that whatever the user sees locally on this computer is 100% saved in the cloud.
 */
export async function syncAllLocalDataToCloud(userId: string): Promise<{
  success: boolean;
  businessesCount: number;
  yearsCount: number;
  message: string;
}> {
  try {
    const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    const businesses = recoverBusinesses();
    const yearsToSync = [2024, 2025, 2026, 2027];
    let totalYearsSynced = 0;

    // 1. Purge any deleted businesses from Cloud Firestore so they never resurrect
    try {
      const existingBizSnap = await getDocs(collection(db, 'users', userId, 'businesses'));
      for (const bDoc of existingBizSnap.docs) {
        if (deletedIds.includes(bDoc.id)) {
          await deleteDoc(bDoc.ref);
          for (const yr of yearsToSync) {
            try {
              await deleteDoc(doc(db, 'users', userId, 'businesses', bDoc.id, 'years', yr.toString()));
            } catch (e) {
              // ignore
            }
          }
          try {
            await deleteDoc(doc(db, 'users', userId, 'businesses', bDoc.id, 'settings', 'partners'));
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (cleanupErr) {
      console.warn('Cloud cleanup of deleted businesses notice:', cleanupErr);
    }

    // 2. Update user profile
    try {
      const userPayload = sanitizeForFirestore({
        uid: userId,
        email: auth.currentUser?.email || '',
        displayName: auth.currentUser?.displayName || '',
        deletedBusinessIds: deletedIds,
        lastSyncedAt: Date.now(),
      });
      await setDoc(doc(db, 'users', userId), userPayload, { merge: true });
    } catch (e) {
      // Non-blocking
    }

    // 3. Save each active business and its subcollections
    for (const biz of businesses) {
      const bizDocRef = doc(db, 'users', userId, 'businesses', biz.id);
      await setDoc(
        bizDocRef,
        sanitizeForFirestore({
          ...biz,
          ownerId: userId,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );

      // Save partners
      const partners = recoverPartnersData(biz.id);
      const partnersDocRef = doc(
        db,
        'users',
        userId,
        'businesses',
        biz.id,
        'settings',
        'partners'
      );
      await setDoc(
        partnersDocRef,
        sanitizeForFirestore({
          partners,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );

      // Save each financial year
      for (const yr of yearsToSync) {
        const months = recoverMonthsData(biz.id, yr);
        if (months && months.length > 0) {
          const yrDocRef = doc(
            db,
            'users',
            userId,
            'businesses',
            biz.id,
            'years',
            yr.toString()
          );
          await setDoc(
            yrDocRef,
            sanitizeForFirestore({
              year: yr,
              monthsData: months,
              updatedAt: Date.now(),
            }),
            { merge: true }
          );
          totalYearsSynced++;
        }
      }
    }

    return {
      success: true,
      businessesCount: businesses.length,
      yearsCount: totalYearsSynced,
      message: `Successfully pushed ${businesses.length} business${businesses.length === 1 ? '' : 'es'} and ${totalYearsSynced} financial years to Google Cloud Firestore!`,
    };
  } catch (err: any) {
    console.error('Error in syncAllLocalDataToCloud:', err);
    return {
      success: false,
      businessesCount: 0,
      yearsCount: 0,
      message: `Failed to push to Cloud: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Comprehensive One-Click Full Pull:
 * Downloads ALL active businesses, partners, and financial years from Google Cloud Firestore into localStorage.
 */
export async function pullAllCloudDataToLocal(userId: string): Promise<{
  success: boolean;
  businessesCount: number;
  message: string;
  businesses?: BusinessTracker[];
}> {
  try {
    const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_BIZ);
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];

    const bizCollectionRef = collection(db, 'users', userId, 'businesses');
    const snapshot = await getDocs(bizCollectionRef);
    if (snapshot.empty) {
      return {
        success: false,
        businessesCount: 0,
        message: 'No business trackers found in your Google Cloud account.',
      };
    }

    const businesses: BusinessTracker[] = [];
    for (const docSnap of snapshot.docs) {
      if (deletedIds.includes(docSnap.id)) {
        // Asynchronously clean up from cloud
        deleteDoc(docSnap.ref).catch(() => {});
      } else {
        businesses.push(docSnap.data() as BusinessTracker);
      }
    }
    businesses.sort((a, b) => a.createdAt - b.createdAt);

    // Save businesses to local storage
    localStorage.setItem(STORAGE_KEY_BUSINESSES, JSON.stringify(businesses));

    const yearsToPull = [2024, 2025, 2026, 2027];
    for (const biz of businesses) {
      // Pull partners
      try {
        const partnersSnap = await getDoc(
          doc(db, 'users', userId, 'businesses', biz.id, 'settings', 'partners')
        );
        if (partnersSnap.exists()) {
          const data = partnersSnap.data();
          if (Array.isArray(data.partners) && data.partners.length > 0) {
            localStorage.setItem(
              `${STORAGE_KEY_PARTNERS}_${biz.id}`,
              JSON.stringify(data.partners)
            );
          }
        }
      } catch (e) {
        // non-blocking
      }

      // Pull each year
      for (const yr of yearsToPull) {
        try {
          const yrSnap = await getDoc(
            doc(db, 'users', userId, 'businesses', biz.id, 'years', yr.toString())
          );
          if (yrSnap.exists()) {
            const yrData = yrSnap.data();
            if (Array.isArray(yrData.monthsData) && yrData.monthsData.length > 0) {
              const cleaned = normalizeMonthData(yrData.monthsData, biz.id);
              localStorage.setItem(
                `${STORAGE_KEY_DATA}_${biz.id}_${yr}`,
                JSON.stringify(cleaned)
              );
            }
          }
        } catch (e) {
          // non-blocking
        }
      }
    }

    return {
      success: true,
      businessesCount: businesses.length,
      message: `Downloaded ${businesses.length} businesses and their financial records from Google Cloud!`,
      businesses,
    };
  } catch (err: any) {
    console.error('Error in pullAllCloudDataToLocal:', err);
    return {
      success: false,
      businessesCount: 0,
      message: `Failed to pull from Cloud: ${err?.message || String(err)}`,
    };
  }
}

/**
 * One-time cloud bootstrap if cloud database has no records for this user
 */
export async function bootstrapCloudFromLocalStorage(
  userId: string,
  localBusinesses: BusinessTracker[],
  localMonthsData: MonthData[],
  localPartners: Partner[],
  year: number
): Promise<boolean> {
  const result = await syncAllLocalDataToCloud(userId);
  return result.success;
}
