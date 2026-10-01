let values: Record<string, string> = {};
let revision = 0;
let generation = 0;
let savedGeneration = 0;
let inFlight = false;
let conflict = false;
let timer: ReturnType<typeof setTimeout>;
let notify = () => {};
export let cloudStatus = 'Loading cloud records…';
export let cloudError = false;
export function onCloudStatus(callback: () => void) { notify = callback; return () => { notify = () => {}; }; }
function status(message: string, error = false) { cloudStatus = message; cloudError = error; notify(); }
export async function loadCloud() {
  const response = await fetch('/api/ledger', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load records. Sign in with your owner account and retry.');
  const data = await response.json(); values = data.values; revision = data.revision;
  generation = savedGeneration = 0; conflict = false;
  status('Saved to cloud');
}
function changed() {
  generation++;
  if (conflict) return;
  status('Unsaved changes'); clearTimeout(timer); timer = setTimeout(saveCloud, 600);
}
export async function saveCloud() {
  if (inFlight || conflict || generation === savedGeneration) return;
  inFlight = true; const writing = generation; const snapshot = { ...values };
  status('Saving…');
  try {
    const response = await fetch('/api/ledger', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, values: snapshot }) });
    const data = await response.json();
    if (!response.ok) { conflict = response.status === 409; throw new Error(data.error || 'Save failed'); }
    revision = data.revision; savedGeneration = writing;
    for (const key of Object.keys(snapshot)) if (values[key] === snapshot[key]) values[key] = data.values[key];
    status(generation === savedGeneration ? 'Saved to cloud' : 'Unsaved changes');
  } catch (error) { status(error instanceof Error ? error.message : 'Save failed. Retry to keep your changes.', true); }
  finally { inFlight = false; if (!cloudError && generation !== savedGeneration) timer = setTimeout(saveCloud, 300); }
}
export const cloudStore = {
  get length() { return Object.keys(values).length; },
  key(i: number) { return Object.keys(values)[i] ?? null; },
  getItem(key: string) {
    if (key === 'airbnb_active_business_id_v2' || key === 'airbnb_tracker_year_v2') return window.localStorage.getItem(key);
    return values[key] ?? null;
  },
  setItem(key: string, value: string) {
    if (key === 'airbnb_active_business_id_v2' || key === 'airbnb_tracker_year_v2') { window.localStorage.setItem(key, value); return; }
    if (values[key] === value) return;
    values[key] = value; changed();
  },
  removeItem(key: string) { if (key in values) { delete values[key]; changed(); } },
};
export function hasUnsavedChanges() { return generation !== savedGeneration; }
globalThis.window?.addEventListener('beforeunload', event => { if (hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; } });
globalThis.window?.addEventListener('online', () => { if (!conflict) void saveCloud(); });
