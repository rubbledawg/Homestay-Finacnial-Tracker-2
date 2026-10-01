import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, Cloud, RefreshCw, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface AuthButtonProps {
  onForceRefresh?: () => void;
  syncState?: 'idle' | 'loading' | 'synced' | 'saving' | 'error';
  lastSyncedTime?: Date | null;
  onOpenSyncModal?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  onForceRefresh,
  syncState = 'idle',
  lastSyncedTime,
  onOpenSyncModal,
}) => {
  const { user, loading, signInWithGoogle, signOut, allowedEmail } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSignIn = async () => {
    setErrorMsg(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 text-[11px]">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          type="button"
          id="google-signin-btn"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700 hover:border-emerald-600 text-emerald-200 hover:text-emerald-100 rounded-lg font-medium text-[11px] transition-all cursor-pointer shadow-sm"
          title="Sign in with Google to sync your financial data across all devices"
        >
          {isSigningIn ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Sign In to Sync</span>
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Local mode" />
        </button>

        {errorMsg && (
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-neutral-900 border border-rose-800 text-rose-300 p-2.5 rounded-lg text-[11px] flex items-center gap-2 shadow-2xl z-50">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        id="user-account-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-200 rounded-lg font-medium text-[11px] transition-colors cursor-pointer"
        title="Google Cloud Sync Active"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-5 h-5 rounded-full object-cover border border-neutral-700 shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-900 border border-emerald-700 text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}

        <div className="flex items-center gap-1.5 max-w-[130px] truncate">
          <span className="truncate">{user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</span>
          {syncState === 'loading' || syncState === 'saving' ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" title="Syncing..." />
          ) : syncState === 'error' ? (
            <AlertCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" title="Sync Notice" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Cloud Synced" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl py-2 z-50 text-xs">
          {/* User Profile Header */}
          <div className="px-3.5 pb-2.5 border-b border-neutral-800 flex items-center gap-2.5">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-9 h-9 rounded-full object-cover border border-neutral-700 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-900 border border-emerald-700 text-emerald-300 flex items-center justify-center text-sm font-bold shrink-0">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-neutral-100 truncate">
                {user.displayName || 'User'}
              </div>
              <div className="text-[11px] text-neutral-400 truncate">{user.email}</div>
            </div>
          </div>

          {/* Cloud Sync Status Card */}
          <div className="px-3.5 py-2.5 border-b border-neutral-800 bg-neutral-950/60">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cloud Sync</span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[10px] px-2 py-0.5 bg-emerald-950/80 border border-emerald-800 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              All bookings, ledgers, receipts & partners sync in real time to your Google Cloud Firestore account.
            </p>
            {lastSyncedTime && (
              <p className="text-[10px] text-neutral-500 mt-1">
                Last updated: {lastSyncedTime.toLocaleTimeString()}
              </p>
            )}

            {onOpenSyncModal && (
              <button
                type="button"
                onClick={() => {
                  onOpenSyncModal();
                  setIsOpen(false);
                }}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shadow-sm"
              >
                <Cloud className="w-3 h-3 text-emerald-400" />
                <span>Cloud Sync & Backup Center</span>
              </button>
            )}

            {onForceRefresh && (
              <button
                type="button"
                onClick={() => {
                  onForceRefresh();
                  setIsOpen(false);
                }}
                className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                <span>Force Refresh from Cloud</span>
              </button>
            )}
          </div>

          {/* Sign Out Action */}
          <div className="pt-1.5 px-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors text-left text-[11px] font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
