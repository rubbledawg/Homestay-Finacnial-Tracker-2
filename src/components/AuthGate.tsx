import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthorized, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (isAuthorized && !loading) return <>{children}</>;

  const handleSignIn = async () => {
    setBusy(true);
    setError('');
    try {
      if (user) await signOut();
      await signInWithGoogle();
    } catch {
      setError('Sign-in could not finish. Please try again and allow the Google sign-in window.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
    <section className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-7">
      <p className="text-xs uppercase tracking-widest text-emerald-400 mb-3">Private ledger</p>
      <h1 className="text-2xl font-semibold mb-3">Your property finances</h1>
      <p className="text-sm text-neutral-400 mb-6">
        {loading ? 'Checking your sign-in…' : user ? 'This Google account does not have access. Please switch to the owner account.' : 'Sign in with your Google account to open your ledger.'}
      </p>
      <button type="button" disabled={loading || busy} onClick={handleSignIn}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3 text-sm font-medium">
        {busy ? 'Signing in…' : user ? 'Switch Google account' : 'Continue with Google'}
      </button>
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
    </section>
  </main>;
}
