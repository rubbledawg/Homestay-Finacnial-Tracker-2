import React, { useState } from 'react';
import { downloadBackupFile, importFullFinancialBackup } from '../utils/dataRecovery';
import { BusinessTracker } from '../types';

export function BackupModal({ isOpen, onClose, onDataRestored }: {
  isOpen: boolean; onClose: () => void;
  onDataRestored?: (businesses?: BusinessTracker[]) => void;
}) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="backup-title" className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-neutral-100" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4"><h2 id="backup-title" className="text-lg font-semibold">Backup & restore</h2><button onClick={onClose} aria-label="Close backup">✕</button></div>
      <p className="text-sm text-neutral-400 mb-5">Your records save to your private cloud workspace. Download an extra backup of all properties, years, partners and receipts anytime.</p>
      <button className="w-full rounded bg-emerald-700 px-4 py-3 mb-3" onClick={async () => { try { await downloadBackupFile(); setMessage('Backup download started. Keep the file somewhere safe.'); } catch { setMessage('The backup could not be downloaded. Please try again.'); } }}>Download backup</button>
      <label className="block text-sm mb-2" htmlFor="backup-file">Restore a backup file</label>
      <input id="backup-file" type="file" accept=".json,application/json" className="w-full text-sm" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        try { setPending(await file.text()); setMessage('Ready to restore. Matching properties and years will be replaced. Download a current backup first.'); }
        catch { setMessage('The file could not be read.'); }
      }} />
      {pending && <button className="mt-4 rounded border border-amber-600 px-4 py-2 text-amber-200" onClick={() => {
        const result = importFullFinancialBackup(pending); setMessage(result.success ? 'Backup restored. Wait for Saved to cloud before closing.' : result.message);
        if (result.success) { setPending(null); onDataRestored?.(result.businesses); }
      }}>Restore selected backup</button>}
      {message && <p role="status" className="mt-4 text-sm text-neutral-300">{message}</p>}
    </section>
  </div>;
}
