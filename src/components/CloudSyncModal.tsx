import React, { useState } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Laptop,
  Home,
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  syncAllLocalDataToCloud,
  pullAllCloudDataToLocal,
} from '../lib/firestoreService';
import {
  downloadBackupFile,
  importFullFinancialBackup,
} from '../utils/dataRecovery';
import { BusinessTracker } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: (businesses?: BusinessTracker[]) => void;
  syncState: 'idle' | 'loading' | 'synced' | 'saving' | 'error';
  lastSyncedTime: Date | null;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  syncState,
  lastSyncedTime,
}) => {
  const { user, signInWithGoogle } = useAuth();
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handlePushToCloud = async () => {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch (err: any) {
        setActionMessage({
          type: 'error',
          text: 'Please sign in with Google to push data to the cloud.',
        });
        return;
      }
    }

    if (!user) return;

    setIsPushing(true);
    setActionMessage({ type: 'info', text: 'Uploading all businesses and financial records to Google Cloud Firestore...' });

    try {
      const result = await syncAllLocalDataToCloud(user.uid);
      if (result.success) {
        setActionMessage({
          type: 'success',
          text: result.message,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: result.message || 'Failed to push data to Cloud.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Unexpected error while uploading to Cloud.',
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!user) {
      setActionMessage({
        type: 'error',
        text: 'Please sign in with Google to download data from Cloud.',
      });
      return;
    }

    setIsPulling(true);
    setActionMessage({ type: 'info', text: 'Downloading financial records from Google Cloud Firestore...' });

    try {
      const result = await pullAllCloudDataToLocal(user.uid);
      if (result.success) {
        setActionMessage({
          type: 'success',
          text: result.message,
        });
        if (onDataRestored && result.businesses) {
          onDataRestored(result.businesses);
        }
      } else {
        setActionMessage({
          type: 'error',
          text: result.message,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Unexpected error while pulling from Cloud.',
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = importFullFinancialBackup(content);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: res.message,
        });
        if (onDataRestored && res.businesses) {
          onDataRestored(res.businesses);
        }
        // If logged in, automatically push imported data to cloud
        if (user) {
          await syncAllLocalDataToCloud(user.uid);
        }
      } else {
        setActionMessage({
          type: 'error',
          text: res.message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      id="cloud-sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="cloud-sync-modal-container"
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-6 text-neutral-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/60 rounded-lg text-emerald-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Cloud Sync & Cross-Device Access
              </h2>
              <p className="text-xs text-neutral-400">
                Ensure your financial ledgers and bookings are accessible from your house, laptop, and phone
              </p>
            </div>
          </div>
          <button
            id="cloud-sync-close-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-4 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                Google Cloud Account
              </div>
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold text-emerald-300 text-sm">{user.email}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="font-medium text-amber-300 text-sm">Not Signed In (Local Mode)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                      Browser Storage Only
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                Last Cloud Sync
              </div>
              <div className="text-xs text-neutral-300 font-medium">
                {lastSyncedTime ? lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not synced in this session'}
              </div>
            </div>
          </div>

          {!user && (
            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-amber-300/90 leading-relaxed max-w-md">
                You are currently in local mode. If you open this link in your house, your data won&apos;t appear until you sign in with Google and push it to the cloud.
              </p>
              <button
                id="modal-google-signin-btn"
                onClick={signInWithGoogle}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In with Google</span>
              </button>
            </div>
          )}
        </div>

        {/* Action Message / Feedback */}
        {actionMessage && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 mb-5 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-800/80 text-emerald-200'
                : actionMessage.type === 'error'
                ? 'bg-rose-950/70 border border-rose-800/80 text-rose-200'
                : 'bg-blue-950/70 border border-blue-800/80 text-blue-200'
            }`}
          >
            {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            {actionMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
            {actionMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />}
            <div className="flex-1">{actionMessage.text}</div>
          </div>
        )}

        {/* Cloud Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-lg bg-neutral-800/60 border border-neutral-700/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1.5">
                <CloudUpload className="w-4 h-4" />
                <span>Push All Local Data to Cloud</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                Takes all businesses (Luxinhaus Siargao, WAJ FINANCES), partners, and 2024-2027 ledgers from this browser and pushes them directly into Google Cloud Firestore.
              </p>
            </div>
            <button
              id="push-to-cloud-btn"
              onClick={handlePushToCloud}
              disabled={isPushing}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow"
            >
              {isPushing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing to Cloud...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>Push to Cloud Now</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 rounded-lg bg-neutral-800/60 border border-neutral-700/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm mb-1.5">
                <CloudDownload className="w-4 h-4" />
                <span>Pull Data from Cloud</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                Loads the latest financial database stored in Google Cloud into this computer&apos;s browser. Use this when you open the app on a new device.
              </p>
            </div>
            <button
              id="pull-from-cloud-btn"
              onClick={handlePullFromCloud}
              disabled={isPulling || !user}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow"
            >
              {isPulling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading from Cloud...</span>
                </>
              ) : (
                <>
                  <CloudDownload className="w-4 h-4" />
                  <span>Download from Cloud</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Offline / JSON File Backup */}
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-950/40 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Direct JSON Backup & Restore (Zero-Cloud Option)</span>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            Download a full copy of your financial ledger to a file on your computer, or import a previously saved file.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="download-json-backup-btn"
              onClick={downloadBackupFile}
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-300" />
              <span>Export Backup (.json)</span>
            </button>

            <label
              id="import-json-backup-label"
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-300" />
              <span>Restore from Backup (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* House / Cross Device Instruction Guide */}
        <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs">
          <div className="font-semibold text-neutral-200 mb-2 flex items-center gap-2">
            <Home className="w-4 h-4 text-amber-400" />
            <span>How to access your financial data at your house:</span>
          </div>
          <ol className="space-y-2 text-neutral-400 pl-5 list-decimal leading-relaxed">
            <li>
              <strong className="text-neutral-200">On this computer:</strong> Click{' '}
              <span className="text-emerald-400 font-medium">&quot;Push to Cloud Now&quot;</span> above. This copies everything from your current browser into your Google Cloud Firestore account.
            </li>
            <li>
              <strong className="text-neutral-200">At your house:</strong> Open the app in your browser and click{' '}
              <span className="text-emerald-400 font-medium">&quot;Sign In with Google&quot;</span> in the top right with your account (<code className="text-neutral-300">alfonso.locsin@gmail.com</code>).
            </li>
            <li>
              Your entire setup (Luxinhaus Siargao, WAJ FINANCES, bookings, and ledger) will load automatically from the cloud!
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
